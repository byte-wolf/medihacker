import { AsyncLocalStorage } from "node:async_hooks";
import type { TokenCall } from "@/lib/types";

/**
 * Token policy: every step has a fixed output cap, prompts stay as short as the task allows,
 * and identical prompts are served from the SQLite cache (0 tokens). Each call is logged
 * (`[tokens] ...` on the server) and collected per request, so a briefing can report its total.
 */
export const TOKEN_LIMITS = {
  /** Picking the 6-8 items: a short list of keys */
  select: 400,
  /** One extraction call covers two items with one or two facts each */
  extract: 2000,
  chat: 2000,
  translate: 3000,
  contradictions: 6000,
  explain: 400,
} as const;

export type TokenUsage = { prompt: number; completion: number; total: number };

const store = new AsyncLocalStorage<TokenCall[]>();

/** Run fn and return every model call it made (including cache hits) with token counts. */
export async function withTokenLog<T>(fn: () => Promise<T>): Promise<{ result: T; calls: TokenCall[] }> {
  const calls: TokenCall[] = [];
  const result = await store.run(calls, fn);
  return { result, calls };
}

export function recordTokens(call: TokenCall) {
  store.getStore()?.push(call);
  if (process.env.NODE_ENV !== "test") {
    console.log(
      `[tokens] ${call.tag || "llm"} ${call.cached ? "cache hit, 0" : `${call.model}: ${call.prompt} in + ${call.completion} out = ${call.total}`}`,
    );
  }
}

export function sumTokens(calls: TokenCall[]): TokenUsage {
  return calls.reduce((a, c) => ({ prompt: a.prompt + c.prompt, completion: a.completion + c.completion, total: a.total + c.total }), {
    prompt: 0,
    completion: 0,
    total: 0,
  });
}
