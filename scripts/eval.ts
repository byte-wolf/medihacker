// Scores the app on the hackathon metrics.
//   bun run eval                 official 5 situations (needs ./data) + extra situations
//   bun run eval -- --official   only the 5 official situations
// Needs a configured LLM. Timings are measured cold (LLM cache bypassed).
import "./env";
import fs from "node:fs";
import path from "node:path";
import { buildBriefing } from "@/lib/briefing/pipeline";
import { awaitContradictionScan, ensureContradictions, listContradictions } from "@/lib/contradictions/store";
import { getPatient, type PatientRecord } from "@/lib/data/patients";
import { readPresetSituations, roleHintFor, SEED_USERS } from "@/lib/db/seed";
import { getProvider, MockProvider, parseJsonObject } from "@/lib/llm/provider";
import { renderSources } from "@/lib/llm/prompts";
import type { BriefingSection, Contradiction } from "@/lib/types";

type Expected = { id: string; situation: string; question: string; answer: string; sources: string[] };
type CaseRun = {
  id: string;
  title: string;
  roles: string[];
  ms: number;
  sections: BriefingSection[];
  questions: { id: string; question: string; expected?: string; sources?: string[] }[];
};

const PATIENT_ID = "0000-0001";
const officialOnly = process.argv.includes("--official");

function screenText(sections: BriefingSection[]) {
  const lines: string[] = [];
  let n = 0;
  for (const s of sections)
    for (const i of s.items) {
      if (i.status !== "documented") lines.push(`[${i.status}] ${i.label}: ${i.note ?? ""}`);
      for (const f of i.facts) {
        n++;
        const docs = [...new Set(f.quotes.map((q) => q.passageId.split(":")[0]))].join(",");
        lines.push(`#${n} ${i.label}: ${f.statement} (sources: ${docs})`);
      }
    }
  return lines.join("\n");
}

async function judgeAnswers(patient: PatientRecord, run: CaseRun) {
  const provider = getProvider();
  const system = `You grade a clinical briefing screen. For each question decide if the SCREEN alone answers it correctly. Use the EXPECTED answer when given; otherwise decide from the SOURCE PASSAGES what the correct answer is. Wording may differ. An answer of "not documented" is correct only if the sources really lack it. Also say which fact numbers (#n) carry the answer. Reply JSON: {"results": [{"id": "<question id>", "answered": true|false, "facts": [<numbers>], "reason": "<short>"}]}`;
  const user = `QUESTIONS:\n${run.questions
    .map((q) => `- id ${q.id}: ${q.question}${q.expected ? `\n  EXPECTED: ${q.expected}` : ""}`)
    .join("\n")}\n\nSCREEN:\n${screenText(run.sections)}${run.questions.some((q) => !q.expected) ? `\n\nSOURCE PASSAGES:${renderSources(patient)}` : ""}`;
  const res = await provider.complete({ messages: [{ role: "system", content: system }, { role: "user", content: user }], json: true, maxTokens: 1500 });
  return parseJsonObject<{ results: { id: string; answered: boolean; facts: number[]; reason: string }[] }>(res.text).results ?? [];
}

async function judgeSupport(patient: PatientRecord, sections: BriefingSection[]) {
  // Traceability / invented facts: does the cited passage text really support each statement?
  const passages = new Map(patient.passages.map((p) => [p.id, p]));
  const facts = sections.flatMap((s) => s.items.flatMap((i) => i.facts));
  if (!facts.length) return { total: 0, supported: 0, unsupported: [] as string[] };
  const system = `For each numbered statement decide if the cited German passages support it (translation, generic drug names and simple arithmetic are fine). Reply JSON: {"results": [{"n": <number>, "supported": true|false}]}`;
  const user = facts
    .map((f, i) => `#${i + 1} ${f.statement}\n${[...f.quotes.map((q) => q.passageId), ...(f.calculation?.inputs.map((x) => x.passageId) ?? [])]
      .map((id) => `   [${id}] ${passages.get(id)?.text.replace(/\s+/g, " ")}`)
      .join("\n")}`)
    .join("\n");
  const res = await getProvider().complete({ messages: [{ role: "system", content: system }, { role: "user", content: user }], json: true, maxTokens: 2000 });
  const results = parseJsonObject<{ results: { n: number; supported: boolean }[] }>(res.text).results ?? [];
  const unsupported = results.filter((r) => !r.supported).map((r) => facts[r.n - 1]?.statement ?? `#${r.n}`);
  return { total: facts.length, supported: facts.length - unsupported.length, unsupported };
}

function scoreContradictions(found: Contradiction[]) {
  const ref = JSON.parse(fs.readFileSync("eval/contradictions.reference.json", "utf8")) as {
    known: { id: string; topic: string; mustLinkDocs: string[]; uncertain?: boolean }[];
  };
  const matched = new Map<string, string>();
  const falseAlarms: string[] = [];
  for (const c of found) {
    const docs = new Set(c.passageIds.map((p) => p.split(":")[0]));
    const hit = ref.known.find(
      (k) => !matched.has(k.id) && k.mustLinkDocs.every((d) => docs.has(d)) && new RegExp(k.topic, "i").test(`${c.title} ${c.explanation}`),
    );
    if (hit) matched.set(hit.id, c.title);
    else falseAlarms.push(c.title);
  }
  const certain = ref.known.filter((k) => !k.uncertain);
  const tp = certain.filter((k) => matched.has(k.id)).length;
  const uncertainHits = ref.known.filter((k) => k.uncertain && matched.has(k.id)).map((k) => k.id);
  return { tp, uncertainHits, falseAlarms, missed: certain.filter((k) => !matched.has(k.id)).map((k) => k.id), score: tp - falseAlarms.length };
}

async function main() {
  if (getProvider() instanceof MockProvider) {
    console.error("The eval needs a configured LLM (see .env.local.example). Aborting.");
    process.exit(1);
  }
  const patient = getPatient(PATIENT_ID);
  if (!patient) throw new Error("Patient data not found. Put the hackathon data at ./data");
  process.env.LLM_CACHE = "off";

  ensureContradictions(patient);
  await awaitContradictionScan(patient.id);
  const contradictions = listContradictions(patient.id);

  const runs: CaseRun[] = [];
  const expected = JSON.parse(fs.readFileSync("data/cases/expected.json", "utf8")) as Expected[];
  const presets = readPresetSituations();
  for (const [idx, s] of presets.entries()) {
    const role = roleHintFor(s.description)?.role ?? "General practitioner";
    const started = Date.now();
    const { sections } = await buildBriefing(patient, [role], s, () => {});
    runs.push({
      id: String(idx + 1),
      title: s.title,
      roles: [role],
      ms: Date.now() - started,
      sections,
      questions: expected.filter((e) => e.situation === s.title).map((e) => ({ id: e.id, question: e.question, expected: e.answer, sources: e.sources })),
    });
    console.log(`situation ${idx + 1} (${s.title}): ${Date.now() - started} ms`);
  }
  if (!officialOnly) {
    const extra = JSON.parse(fs.readFileSync("eval/extra-situations.json", "utf8")) as {
      situations: { id: string; user: string; title: string; description: string; questions: string[] }[];
    };
    for (const s of extra.situations) {
      const role = SEED_USERS.find((u) => u.username === s.user)!.role;
      const started = Date.now();
      const { sections } = await buildBriefing(patient, [role], s, () => {});
      runs.push({ id: s.id, title: s.title, roles: [role], ms: Date.now() - started, sections, questions: s.questions.map((q, i) => ({ id: `${s.id}.${i + 1}`, question: q })) });
      console.log(`extra ${s.id} (${s.title}): ${Date.now() - started} ms`);
    }
  }

  const report: string[] = [`# Evaluation results`, ``, `Provider: ${getProvider().name} · ${new Date().toISOString()}`, ``];
  const json: Record<string, unknown> = { runs: [] };
  let correct = 0;
  let officialQuestions = 0;
  let factsTotal = 0;
  let factsSupported = 0;
  const unsupportedAll: string[] = [];
  for (const run of runs) {
    const verdicts = await judgeAnswers(patient, run);
    const support = await judgeSupport(patient, run.sections);
    factsTotal += support.total;
    factsSupported += support.supported;
    unsupportedAll.push(...support.unsupported);
    const facts = run.sections.flatMap((s) => s.items.flatMap((i) => i.facts));
    report.push(`## ${run.id}. ${run.title} (${run.roles.join(" + ")}) — ${(run.ms / 1000).toFixed(1)} s`, "");
    for (const q of run.questions) {
      const v = verdicts.find((x) => x.id === q.id);
      // Official metric: the answer needs a link to one of its expected source documents ("not documented" needs none).
      const linkOk =
        !q.sources ||
        q.sources.length === 0 ||
        (v?.facts ?? []).some((n) => facts[n - 1]?.quotes.some((qq) => q.sources!.includes(qq.passageId.split(":")[0])));
      const ok = !!v?.answered && linkOk;
      if (q.expected) {
        officialQuestions++;
        if (ok) correct++;
      }
      report.push(`- ${ok ? "✅" : "❌"} **${q.id}** ${q.question}${v ? ` — ${v.reason}` : ""}${v?.answered && !linkOk ? " (no link to an expected source)" : ""}`);
    }
    report.push("");
    (json.runs as unknown[]).push({ ...run, verdicts, support });
  }
  const c = scoreContradictions(contradictions);
  const slowest = Math.max(...runs.slice(0, 5).map((r) => r.ms));
  const summary = [
    `| Metric | Result | Target |`,
    `|---|---|---|`,
    `| Correct answers (official 5 situations) | ${correct} / ${officialQuestions} | 15 / 15 |`,
    `| Traceability (judge: cited passage supports the fact) | ${factsTotal ? ((100 * factsSupported) / factsTotal).toFixed(1) : "–"}% of ${factsTotal} facts | 100% |`,
    `| Invented facts | ${unsupportedAll.length} | 0 |`,
    `| Contradictions (found − false alarms) | ${c.score} (${c.tp} known found, ${c.falseAlarms.length} other) | ≥ 5 |`,
    `| Load time, slowest of the official 5 (cold) | ${(slowest / 1000).toFixed(1)} s | < 10 s |`,
    ``,
    `Contradictions shown: ${contradictions.map((x) => `${x.title} [${x.detectedBy}]`).join("; ")}.`,
    c.missed.length ? `Missed known contradictions: ${c.missed.join(", ")}.` : "All known contradictions found.",
    c.uncertainHits.length ? `Also found (uncertain in reference): ${c.uncertainHits.join(", ")}.` : "",
    c.falseAlarms.length ? `Not in the reference (check manually): ${c.falseAlarms.join("; ")}.` : "",
    unsupportedAll.length ? `Facts the judge did not consider supported: ${unsupportedAll.join("; ")}.` : "",
    ``,
  ];
  report.splice(4, 0, ...summary);
  fs.mkdirSync("eval", { recursive: true });
  fs.writeFileSync(path.join("eval", "results.md"), report.join("\n"));
  fs.writeFileSync(path.join("eval", "results.json"), JSON.stringify({ ...json, contradictions: c, summary }, null, 2));
  console.log(summary.join("\n"));
  console.log("\nWritten eval/results.md");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
