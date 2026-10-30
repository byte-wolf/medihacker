import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { cachedComplete } from "@/lib/llm/cache";
import { TOKEN_LIMITS } from "@/lib/llm/tokens";
import { llmConfigured, parseJsonObject } from "@/lib/llm/provider";
import { TRANSLATION_VERSION, translationIsSafe } from "@/lib/llm/glossary";
import { translationPrompt } from "@/lib/llm/prompts";
import type { PatientRecord } from "./patients";

const running = new Map<string, Promise<void>>();

/** Stored translations belong to one document version and one translation prompt version. */
const versionKey = (patient: PatientRecord) => `${patient.hash}:${TRANSLATION_VERSION}`;

/** Machine-translate every passage once (per document, in parallel) and store it. Runs in the background. */
export function ensureTranslations(patient: PatientRecord): Promise<void> {
  if (!llmConfigured()) return Promise.resolve();
  const existing = running.get(patient.id);
  if (existing) return existing;
  const db = getDb();
  const done = new Set(
    db
      .select({ id: schema.passageTranslations.passageId })
      .from(schema.passageTranslations)
      .where(and(eq(schema.passageTranslations.patientId, patient.id), eq(schema.passageTranslations.docHash, versionKey(patient))))
      .all()
      .map((r) => r.id),
  );
  const todo = patient.passages.filter((p) => !done.has(p.id));
  if (!todo.length) return Promise.resolve();
  const docs = [...new Set(todo.map((p) => p.docId))];
  // One document at a time: translations are background work and must not crowd out briefing requests.
  const job = (async () => {
    // Small batches: long JSON answers from the fast model are more often malformed.
    const batches = docs.flatMap((docId) => {
      const all = todo.filter((p) => p.docId === docId);
      return Array.from({ length: Math.ceil(all.length / 20) }, (_, i) => ({ docId, batch: all.slice(i * 20, i * 20 + 20) }));
    });
    for (const { docId, batch } of batches) {
      const { system, user } = translationPrompt(batch);
      try {
        const { text } = await cachedComplete({
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          json: true,
          fast: true,
          tag: "translate",
          maxTokens: TOKEN_LIMITS.translate,
        });
        const map = parseJsonObject<{ translations?: Record<string, string> }>(text).translations ?? {};
        for (const p of batch) {
          const t = map[p.id];
          if (typeof t !== "string" || !t.trim()) continue;
          // A known wrong meaning (e.g. KM as "milk") is never stored: the German original is shown instead.
          if (!translationIsSafe(p.text, t)) {
            console.warn(`[translations] rejected unsafe translation of ${p.id}`);
            continue;
          }
          db.insert(schema.passageTranslations)
            .values({ passageId: p.id, patientId: patient.id, docHash: versionKey(patient), translation: t.trim() })
            .onConflictDoUpdate({ target: schema.passageTranslations.passageId, set: { translation: t.trim(), docHash: versionKey(patient) } })
            .run();
        }
      } catch (err) {
        console.error(`[translations] ${docId} failed:`, err instanceof Error ? err.message : err);
      }
    }
  })().finally(() => running.delete(patient.id));
  running.set(patient.id, job);
  return job;
}

export function translationsForDocument(patient: PatientRecord, docId: string): Record<string, string> {
  const rows = getDb()
    .select()
    .from(schema.passageTranslations)
    .where(and(eq(schema.passageTranslations.patientId, patient.id), eq(schema.passageTranslations.docHash, versionKey(patient))))
    .all();
  return Object.fromEntries(rows.filter((r) => r.passageId.startsWith(`${docId}:`)).map((r) => [r.passageId, r.translation]));
}
