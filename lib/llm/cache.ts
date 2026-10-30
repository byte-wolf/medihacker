import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getProvider, parseJsonObject, type CompleteOptions } from "./provider";
import { PROMPT_VERSION } from "./prompts";

export function hashKey(parts: unknown[]): string {
  return crypto.createHash("sha256").update(JSON.stringify([PROMPT_VERSION, ...parts])).digest("hex");
}

const running = new Map<string, Promise<{ text: string; cached: boolean }>>();

/** Complete with a SQLite-backed cache keyed by the full prompt. Returns whether the result came from cache. */
export async function cachedComplete(opts: CompleteOptions): Promise<{ text: string; cached: boolean }> {
  const provider = getProvider();
  const key = hashKey([provider.cacheIdentity ?? provider.name, opts.fast ?? false, opts.messages, opts.json ?? false, opts.maxTokens, opts.temperature, ...(opts.jsonSchema ? [opts.jsonSchema] : [])]);
  const db = getDb();
  // LLM_CACHE=off measures cold timings (the eval does this); results are still written.
  const hit = process.env.LLM_CACHE === "off" ? undefined : db.select().from(schema.llmCache).where(eq(schema.llmCache.promptHash, key)).get();
  if (hit) {
    try {
      if (opts.json) parseJsonObject(hit.response);
      return { text: hit.response, cached: true };
    } catch { /* Replace invalid responses left by older versions. */ }
  }
  const pending = running.get(key);
  if (pending) return pending;
  const job = (async () => {
    const res = await provider.complete(opts);
    if (opts.json) parseJsonObject(res.text);
    db.insert(schema.llmCache)
      .values({ promptHash: key, response: res.text })
      .onConflictDoUpdate({ target: schema.llmCache.promptHash, set: { response: res.text, createdAt: new Date() } })
      .run();
    return { text: res.text, cached: false };
  })().finally(() => running.delete(key));
  running.set(key, job);
  return job;
}
