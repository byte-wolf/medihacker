import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { cachedComplete } from "@/lib/llm/cache";
import { llmConfigured, parseJsonObject } from "@/lib/llm/provider";
import { translationPrompt } from "@/lib/llm/prompts";
import type { PatientRecord } from "./patients";

const running = new Map<string, Promise<void>>();

/** Translate only requested passages; omit ids only for explicit offline indexing. */
export function ensureTranslations(patient: PatientRecord, passageIds?: string[]): Promise<void> {
  if (!llmConfigured()) return Promise.resolve();
  const selected = passageIds ? new Set(passageIds) : null;
  const key = JSON.stringify([patient.id, patient.hash, passageIds ? [...selected!].sort() : "all"]);
  const existing = running.get(key);
  if (existing) return existing;
  const db = getDb();
  const done = new Set(db.select({ id: schema.passageTranslations.passageId }).from(schema.passageTranslations)
    .where(and(eq(schema.passageTranslations.patientId, patient.id), eq(schema.passageTranslations.docHash, patient.hash))).all().map((r) => r.id));
  const todo = patient.passages.filter((p) => (!selected || selected.has(p.id)) && !done.has(p.id));
  if (!todo.length) return Promise.resolve();
  const job = (async () => {
    // Small sequential batches avoid a burst of eight full-document requests.
    for (let offset = 0; offset < todo.length; offset += 20) {
      const batch = todo.slice(offset, offset + 20);
      const { system, user } = translationPrompt(batch);
      const { text } = await cachedComplete({
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        json: true, fast: true, tag: "translate", maxTokens: 3000,
      });
      const map = parseJsonObject<{ translations?: Record<string, string> }>(text).translations ?? {};
      for (const p of batch) {
        const t = map[p.id];
        if (typeof t !== "string" || !t.trim()) continue;
        db.insert(schema.passageTranslations).values({ passageId: p.id, patientId: patient.id, docHash: patient.hash, translation: t.trim() })
          .onConflictDoUpdate({ target: schema.passageTranslations.passageId, set: { translation: t.trim(), docHash: patient.hash } }).run();
      }
    }
  })().finally(() => running.delete(key));
  running.set(key, job);
  return job;
}

export function translationsForDocument(patient: PatientRecord, docId: string): Record<string, string> {
  const rows = getDb().select().from(schema.passageTranslations)
    .where(and(eq(schema.passageTranslations.patientId, patient.id), eq(schema.passageTranslations.docHash, patient.hash))).all();
  return Object.fromEntries(rows.filter((r) => r.passageId.startsWith(`${docId}:`)).map((r) => [r.passageId, r.translation]));
}
