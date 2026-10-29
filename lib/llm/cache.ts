import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getProvider, type CompleteOptions } from "./provider";
import { PROMPT_VERSION } from "./prompts";

export function hashKey(parts: unknown[]): string {
  return crypto.createHash("sha256").update(JSON.stringify([PROMPT_VERSION, ...parts])).digest("hex");
}

/** Complete with a SQLite-backed cache keyed by the full prompt. Returns whether the result came from cache. */
export async function cachedComplete(opts: CompleteOptions): Promise<{ text: string; cached: boolean }> {
  const provider = getProvider();
  const key = hashKey([provider.name, opts.fast ?? false, opts.messages, opts.json ?? false]);
  const db = getDb();
  const hit = db.select().from(schema.llmCache).where(eq(schema.llmCache.promptHash, key)).get();
  if (hit) return { text: hit.response, cached: true };
  const res = await provider.complete(opts);
  db.insert(schema.llmCache).values({ promptHash: key, response: res.text }).onConflictDoNothing().run();
  return { text: res.text, cached: false };
}
