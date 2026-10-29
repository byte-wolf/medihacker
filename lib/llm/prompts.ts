import type { PatientRecord } from "@/lib/data/patients";
import type { PlannedItem } from "@/lib/catalog/roles";
import type { Passage } from "@/lib/types";

// Bump when prompts change so cached LLM responses are not reused.
export const PROMPT_VERSION = "v1";

/** Passages that carry no clinical content (address block, salutations). */
function isBoilerplate(p: Passage): boolean {
  return (
    p.text.length < 3 ||
    /^(Frau|Herr|Beispielpatientin|Straße\b|PLZ\b|Sehr geehrte|Mit (freundlichen|kollegialen) Grüßen|OA |ARZT |Befund(et)?: Dr|Vidiert|vidiert|befundet)/i.test(p.text.trim())
  );
}

/** All documents as numbered passages, the model's only allowed source. */
export function renderSources(patient: PatientRecord): string {
  const lines: string[] = [];
  for (const doc of patient.documents) {
    lines.push(`\n### DOCUMENT ${doc.id} | ${doc.title} | dated ${doc.date} | ${doc.department}`);
    for (const p of patient.passages) {
      if (p.docId !== doc.id || isBoilerplate(p)) continue;
      const section = p.section ? ` (${p.section})` : "";
      lines.push(`[${p.id}]${section} ${p.text.replace(/\s*\n\s*/g, " ")}`);
    }
  }
  return lines.join("\n");
}

const FACT_RULES = `RULES (patient safety, follow exactly):
- Use ONLY the numbered source passages. Never use outside knowledge to add facts. You may use medical knowledge only to judge relevance, translate German to English, and name generic drugs (e.g. Blopress = candesartan).
- Every fact must cite one or more passage ids and quote the German source text VERBATIM (copy the exact characters, can be a shorter substring of the passage).
- Every number you write must appear in a cited passage, except calculated values (see below). Do not convert units.
- "Present tense" means as of the date of the latest document. Prefer the most recent source; when a value is old, say when it was documented (e.g. "June 2015"). If several dated values exist and the trend matters (weight, doses), give each with its date.
- If the documents do not contain the information, set status "not_documented" and explain briefly in "note" what is missing (e.g. "No creatinine or eGFR in any of the 8 documents; lab tables are empty."). Never guess.
- Medication schedules are morning-midday-evening(-night): write "1 0 1 0" as "1-0-1" (leave out the night column when it is 0).
- Calculated values (weight change, BMI) are allowed: add "calculation": {"type": "difference" | "bmi", "inputs": [{"passageId": "...", "value": <number from that passage>, "unit": "kg"}...], "result": <number>}. Inputs for a difference are ordered oldest first.
- Statements are short clinical English (max ~25 words), key value first. No hedging prose. Do not mention passage ids in statements.`;

const FACT_SCHEMA = `{"items": [{"key": "<item key>", "status": "documented" | "not_documented", "note": "<only for not_documented>", "facts": [{"statement": "<English>", "quotes": [{"passageId": "<id>", "text": "<verbatim German>"}], "calculation": null}]}]}`;

export function extractionPrompt(args: {
  patient: PatientRecord;
  roles: string[];
  situation: { title: string; description: string } | null;
  sectionTitle: string;
  items: PlannedItem[];
}) {
  const { patient, roles, situation, items } = args;
  const system = `You are a clinical documentation assistant. You extract patient facts from German hospital documents for one clinician and one task, in English.\n\n${FACT_RULES}\n\nAnswer with a single JSON object of this shape:\n${FACT_SCHEMA}`;
  const user = `PATIENT: ${patient.name}, ${patient.sex}, born ${patient.dateOfBirth}. Latest document: ${patient.latestDocumentDate} (this is "now").
CLINICIAN ROLE: ${roles.join(" + ")}
SITUATION: ${situation ? `${situation.title}. ${situation.description}` : "General review (no specific situation)."}

SECTION "${args.sectionTitle}". For each item below return the facts this clinician needs for this situation. Give 1-4 facts per item; prefer fewer, more precise facts. Answer every item.
${items.map((i) => `- key "${i.key}": ${i.label}. ${i.guidance}`).join("\n")}

SOURCE PASSAGES:${renderSources(patient)}`;
  return { system, user };
}

export function planPrompt(args: { roles: string[]; situation: { title: string; description: string }; existing: string[] }) {
  const system = `You help plan a one-screen clinical briefing. Given a clinician's role and situation, list the specific questions this clinician will most likely need answered from the patient's records that are NOT already covered by the existing items. Reply with JSON: {"items": [{"key": "custom_<short_snake_case>", "label": "<question, max 12 words>", "guidance": "<what to look for in the records>"}]}. Return 0-4 items. Do not invent patient facts.`;
  const user = `ROLE: ${args.roles.join(" + ")}\nSITUATION: ${args.situation.title}. ${args.situation.description}\nEXISTING ITEMS: ${args.existing.join("; ")}`;
  return { system, user };
}

export function chatPrompt(args: {
  patient: PatientRecord;
  roles: string[];
  situation: { title: string; description: string } | null;
  history: { role: "user" | "assistant"; text: string }[];
  question: string;
}) {
  const system = `You are a clinical documentation assistant answering a clinician's question about one patient from German hospital documents, in English.\n\n${FACT_RULES}\n\nAnswer with a single JSON object of this shape (usually one item; use several only for clearly separate sub-questions):\n{"items": [{"key": "answer_1", "label": "<short heading for the answer>", "status": "documented" | "not_documented", "note": "...", "facts": [...]}]}`;
  const history = args.history
    .slice(-6)
    .map((h) => `${h.role === "user" ? "CLINICIAN" : "ASSISTANT"}: ${h.text}`)
    .join("\n");
  const user = `PATIENT: ${args.patient.name}, ${args.patient.sex}, born ${args.patient.dateOfBirth}. Latest document: ${args.patient.latestDocumentDate} (this is "now").
CLINICIAN ROLE: ${args.roles.join(" + ")}
SITUATION: ${args.situation ? `${args.situation.title}. ${args.situation.description}` : "None selected."}
${history ? `\nCONVERSATION SO FAR:\n${history}\n` : ""}
QUESTION: ${args.question}

SOURCE PASSAGES:${renderSources(args.patient)}`;
  return { system, user };
}

export function translationPrompt(passages: Passage[]) {
  const system = `Translate German clinical text to concise clinical English. Keep numbers, units, drug names and abbreviations unchanged. Reply with JSON: {"translations": {"<id>": "<English>"}} with every id.`;
  const user = JSON.stringify(Object.fromEntries(passages.map((p) => [p.id, p.text.replace(/\s*\n\s*/g, " ")])));
  return { system, user };
}

export function contradictionPrompt(patient: PatientRecord) {
  const system = `You audit German hospital documents of one patient for CONTRADICTIONS: two or more passages that cannot all be true at the same time (e.g. two different dates for the same event, a finding on the left in one passage and on the right in another, a BMI that does not match height and weight in the same letter, the same examination reported with different results).
NOT contradictions: small measurement differences (e.g. 170 vs 171 cm, BP 140/90 vs 145/90 at slightly different times), values that changed over time (weight loss, dose changes between letters), planned vs actual events, different wording of the same thing.
Be conservative: a false alarm is worse than a miss. Reply with JSON: {"contradictions": [{"title": "<short English title>", "explanation": "<one plain English sentence>", "severity": "high" | "medium" | "low", "passageIds": ["<every passage involved>"]}]}`;
  return { system, user: `SOURCE PASSAGES:${renderSources(patient)}` };
}

export function skepticPrompt(candidates: { title: string; explanation: string; passages: { id: string; text: string; date: string }[] }[]) {
  const system = `You are a strict reviewer. For each candidate contradiction decide whether the cited passages truly CANNOT all be true. Reject it if it could be explained by change over time, measurement noise, planned vs actual, rounding, or different wording. Reply with JSON: {"verdicts": [{"index": <number>, "keep": true | false, "reason": "<short>"}]}`;
  const user = candidates
    .map(
      (c, i) =>
        `#${i} ${c.title}: ${c.explanation}\n${c.passages.map((p) => `  [${p.id}] (${p.date}) ${p.text.replace(/\s*\n\s*/g, " ")}`).join("\n")}`,
    )
    .join("\n\n");
  return { system, user };
}
