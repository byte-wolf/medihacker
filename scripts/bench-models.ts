// Compares candidate models on real briefing prompts: latency, valid JSON,
// and how many returned facts pass the verifier (verbatim quotes, numbers).
//   bun run bench -- model/a model/b ...      (defaults to BENCH_MODELS below)
import "./env";
import { verifyContext } from "@/lib/briefing/items";
import { verifyFact, type RawFact } from "@/lib/briefing/verify";
import { deterministicPlan } from "@/lib/catalog/roles";
import { getPatient } from "@/lib/data/patients";
import { readPresetSituations } from "@/lib/db/seed";
import { OpenAiCompatibleProvider, parseJsonObject } from "@/lib/llm/provider";
import { extractionPrompt } from "@/lib/llm/prompts";

const BENCH_MODELS = [
  "deepseek/deepseek-v4-flash",
  "deepseek/deepseek-v4.1-flash-1017",
  "z-ai/glm-4.7-flash",
  "~z-ai/glm-flash-latest",
  "~moonshotai/kimi-latest",
  "anthropic/claude-haiku-5.5",
  "openai/gpt-5-nano",
  "openai/gpt-5.6-luna",
  "google/gemini-3.1-flash-lite",
  "mistralai/mistral-small-3.2-24b-instruct",
  "meta-llama/llama-4-scout",
];

async function main() {
  const models = process.argv.slice(2).length ? process.argv.slice(2) : BENCH_MODELS;
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");
  const patient = getPatient("0000-0001")!;
  const ctx = verifyContext(patient);
  const situation = readPresetSituations()[0];
  const plan = deterministicPlan(["Anaesthetist"], `${situation.title} ${situation.description}`);
  // Two sections: simple lookups (safety) and one with a calculation (metabolic: weight change)
  const sections = plan.filter((s) => s.id === "safety" || s.id === "metabolic");

  const rows = await Promise.all(
    models.map(async (model) => {
      const provider = new OpenAiCompatibleProvider({
        name: model,
        baseUrl: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
        apiKey: key,
        model,
        timeoutMs: 60_000,
        maxConcurrency: 2,
        extraBody: { reasoning: { effort: process.env.OPENROUTER_REASONING_EFFORT || "minimal" } },
      });
      const result = { model, ms: [] as number[], ok: 0, rejected: 0, notDoc: 0, errors: [] as string[], examples: [] as string[] };
      await Promise.all(
        sections.map(async (s) => {
          const { system, user } = extractionPrompt({ patient, roles: ["Anaesthetist"], situation, sectionTitle: s.title, items: s.items });
          try {
            const r = await provider.complete({ messages: [{ role: "system", content: system }, { role: "user", content: user }], json: true, maxTokens: Number(process.env.BENCH_MAX_TOKENS ?? 2500) });
            result.ms.push(r.ms);
            const parsed = parseJsonObject<{ items?: { key: string; status?: string; facts?: RawFact[] }[] }>(r.text);
            for (const item of parsed.items ?? []) {
              if (item.status === "not_documented") {
                result.notDoc++;
                if (process.env.BENCH_VERBOSE) console.log(`  ${model} [${item.key}] NOT DOCUMENTED`);
              }
              for (const f of item.facts ?? []) {
                const v = verifyFact(f, ctx);
                if (process.env.BENCH_VERBOSE) console.log(`  ${model} [${item.key}] ${v.ok ? "OK " : "REJ"} ${f.statement}${v.ok ? "" : `  <- ${v.reason}`}`);
                if (v.ok) {
                  result.ok++;
                  if (result.examples.length < 3) result.examples.push(`[${item.key}] ${v.fact.statement}`);
                } else result.rejected++;
              }
            }
          } catch (err) {
            result.errors.push((err instanceof Error ? err.message : String(err)).slice(0, 140));
          }
        }),
      );
      return result;
    }),
  );

  for (const r of rows.sort((a, b) => b.ok - b.rejected - (a.ok - a.rejected))) {
    const slowest = r.ms.length ? Math.max(...r.ms) : NaN;
    console.log(
      `${r.model.padEnd(42)} verified ${String(r.ok).padStart(2)}  rejected ${String(r.rejected).padStart(2)}  not-doc ${r.notDoc}  slowest ${Number.isNaN(slowest) ? "  –  " : (slowest / 1000).toFixed(1) + " s"}${r.errors.length ? `  ERRORS: ${r.errors.join(" | ")}` : ""}`,
    );
    for (const e of r.examples) console.log(`    ${e}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
