import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { PatientRecord } from "@/lib/data/patients";
import { cachedComplete } from "@/lib/llm/cache";
import { llmConfigured, parseJsonObject } from "@/lib/llm/provider";
import { contradictionPrompt, PROMPT_VERSION, skepticPrompt } from "@/lib/llm/prompts";
import type { Contradiction } from "@/lib/types";
import { contradictionId, runContradictionRules } from "./rules";

function overlap(a: string[], b: string[]): number {
  const sb = new Set(b);
  return a.filter((x) => sb.has(x)).length;
}

/** Save rule-based contradictions for the patient (replacing earlier rule results). */
function saveRuleResults(patient: PatientRecord, found: Contradiction[]) {
  const db = getDb();
  db.delete(schema.contradictions)
    .where(and(eq(schema.contradictions.patientId, patient.id), eq(schema.contradictions.detectedBy, "rule")))
    .run();
  for (const c of found) {
    db.insert(schema.contradictions).values({ ...c, patientId: patient.id }).onConflictDoNothing().run();
  }
}

/**
 * LLM scan for contradictions the rules cannot express, followed by a skeptic
 * pass that removes time-course changes and noise. Candidates that overlap a
 * rule finding are dropped (the rule result is kept).
 */
export async function llmContradictions(patient: PatientRecord, existing: Contradiction[]): Promise<Contradiction[]> {
  const passages = new Map(patient.passages.map((p) => [p.id, p]));
  const docDate = new Map(patient.documents.map((d) => [d.id, d.date]));
  const { system, user } = contradictionPrompt(patient);
  const { text } = await cachedComplete({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    json: true,
    tag: "contradictions",
    maxTokens: 3000,
  });
  type Cand = { title?: string; explanation?: string; severity?: string; passageIds?: string[] };
  const raw = parseJsonObject<{ contradictions?: Cand[] }>(text).contradictions ?? [];
  const candidates = raw
    .map((c) => ({ ...c, passageIds: (c.passageIds ?? []).filter((id) => passages.has(id)) }))
    .filter((c) => c.title && c.explanation && c.passageIds.length >= 2)
    .filter((c) => !existing.some((e) => overlap(e.passageIds, c.passageIds) >= 2));
  if (!candidates.length) return [];

  const sk = skepticPrompt(
    candidates.map((c) => ({
      title: c.title!,
      explanation: c.explanation!,
      passages: c.passageIds.map((id) => ({ id, text: passages.get(id)!.text, date: docDate.get(passages.get(id)!.docId) ?? "" })),
    })),
  );
  const verdictText = await cachedComplete({
    messages: [
      { role: "system", content: sk.system },
      { role: "user", content: sk.user },
    ],
    json: true,
    tag: "skeptic",
  });
  const verdicts = parseJsonObject<{ verdicts?: { index: number; keep: boolean }[] }>(verdictText.text).verdicts ?? [];
  return candidates
    .filter((_, i) => verdicts.find((v) => v.index === i)?.keep === true)
    .map((c) => ({
      id: contradictionId("llm", c.passageIds),
      title: c.title!,
      explanation: c.explanation!,
      severity: (["high", "medium", "low"].includes(c.severity ?? "") ? c.severity : "medium") as Contradiction["severity"],
      categories: [],
      passageIds: c.passageIds,
      detectedBy: "llm" as const,
    }));
}

const running = new Map<string, Promise<void>>();
const rulesRan = new Set<string>();

/**
 * Make sure the patient's contradictions are computed for the current documents.
 * Rules run synchronously (milliseconds); the optional LLM scan is opt-in.
 */
export function ensureContradictions(patient: PatientRecord): void {
  const db = getDb();
  // Rules take milliseconds: re-run them once per server process so rule changes apply immediately.
  const rules = runContradictionRules(patient);
  if (!rulesRan.has(patient.id + patient.hash)) {
    saveRuleResults(patient, rules);
    rulesRan.add(patient.id + patient.hash);
  }
  const idx = db.select().from(schema.patientIndex).where(eq(schema.patientIndex.patientId, patient.id)).get();
  const wantMode = process.env.LLM_CONTRADICTION_SCAN === "on" && llmConfigured() ? "rules+llm" : "rules";
  if (idx && idx.docHash === patient.hash && idx.promptVersion === PROMPT_VERSION && (idx.contradictionMode === wantMode || idx.contradictionMode === "rules+llm")) {
    return;
  }
  const upsert = (mode: string) =>
    db
      .insert(schema.patientIndex)
      .values({ patientId: patient.id, docHash: patient.hash, promptVersion: PROMPT_VERSION, contradictionMode: mode })
      .onConflictDoUpdate({
        target: schema.patientIndex.patientId,
        set: { docHash: patient.hash, promptVersion: PROMPT_VERSION, contradictionMode: mode, indexedAt: new Date() },
      })
      .run();
  upsert("rules");
  if (wantMode !== "rules+llm" || running.has(patient.id)) return;
  const job = llmContradictions(patient, rules)
    .then((found) => {
      db.delete(schema.contradictions)
        .where(and(eq(schema.contradictions.patientId, patient.id), eq(schema.contradictions.detectedBy, "llm")))
        .run();
      for (const c of found) db.insert(schema.contradictions).values({ ...c, patientId: patient.id }).onConflictDoNothing().run();
      upsert("rules+llm");
    })
    .catch((err) => console.error("[contradictions] LLM scan failed:", err))
    .finally(() => running.delete(patient.id));
  running.set(patient.id, job);
}

/** Wait for a running background scan (used by the indexing script and eval). */
export async function awaitContradictionScan(patientId: string) {
  await running.get(patientId);
}

export function listContradictions(patientId: string): Contradiction[] {
  return getDb()
    .select()
    .from(schema.contradictions)
    .where(eq(schema.contradictions.patientId, patientId))
    .all()
    .map((r) => ({
      id: r.id,
      title: r.title,
      explanation: r.explanation,
      severity: r.severity,
      categories: r.categories,
      passageIds: r.passageIds,
      detectedBy: r.detectedBy,
    }))
    .sort((a, b) => ["high", "medium", "low"].indexOf(a.severity) - ["high", "medium", "low"].indexOf(b.severity));
}
