import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { cachedComplete } from "@/lib/llm/cache";
import { llmConfigured, parseJsonObject } from "@/lib/llm/provider";
import { translationPrompt } from "@/lib/llm/prompts";
import type { PatientRecord } from "./patients";

const running = new Map<string, Promise<void>>();

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
      .where(and(eq(schema.passageTranslations.patientId, patient.id), eq(schema.passageTranslations.docHash, patient.hash)))
      .all()
      .map((r) => r.id),
  );
  const todo = patient.passages.filter((p) => !done.has(p.id));
  if (!todo.length) return Promise.resolve();
  const docs = [...new Set(todo.map((p) => p.docId))];
  const job = Promise.all(
    docs.map(async (docId) => {
      const batch = todo.filter((p) => p.docId === docId);
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
          maxTokens: 6000,
        });
        const map = parseJsonObject<{ translations?: Record<string, string> }>(text).translations ?? {};
        for (const p of batch) {
          const t = map[p.id];
          if (typeof t !== "string" || !t.trim()) continue;
          db.insert(schema.passageTranslations)
            .values({ passageId: p.id, patientId: patient.id, docHash: patient.hash, translation: t.trim() })
            .onConflictDoUpdate({ target: schema.passageTranslations.passageId, set: { translation: t.trim(), docHash: patient.hash } })
            .run();
        }
      } catch (err) {
        console.error(`[translations] ${docId} failed:`, err);
      }
    }),
  )
    .then(() => undefined)
    .finally(() => running.delete(patient.id));
  running.set(patient.id, job);
  return job;
}

export function translationsForDocument(patient: PatientRecord, docId: string): Record<string, string> {
  const rows = getDb()
    .select()
    .from(schema.passageTranslations)
    .where(and(eq(schema.passageTranslations.patientId, patient.id), eq(schema.passageTranslations.docHash, patient.hash)))
    .all();
  return Object.fromEntries(rows.filter((r) => r.passageId.startsWith(`${docId}:`)).map((r) => [r.passageId, r.translation]));
}
