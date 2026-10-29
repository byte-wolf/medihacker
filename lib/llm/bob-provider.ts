/**
 * BobProvider — IBM Bob inference API (OpenAI-compatible).
 *
 * Auth:
 *   - Inference key: Authorization: Bearer <key>  (no extra headers)
 *   - General key:   Authorization: Bearer <key>  + team-id: <team_id>
 *                    (optionally instance-id: <instance_id>)
 *
 * The base URL and model are configured via env vars (see .env.local.example).
 */
import type { LlmProvider, CompleteOptions, CompleteResult } from "./types";

function buildHeaders(): Record<string, string> {
  const key = process.env.BOB_API_KEY;
  if (!key) throw new Error("BOB_API_KEY is not set");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };

  const teamId = process.env.BOB_TEAM_ID;
  if (teamId) headers["team-id"] = teamId;

  const instanceId = process.env.BOB_INSTANCE_ID;
  if (instanceId) headers["instance-id"] = instanceId;

  return headers;
}

function buildUrl(path: string): string {
  const base = (process.env.BOB_BASE_URL ?? "").replace(/\/$/, "");
  if (!base) throw new Error("BOB_BASE_URL is not set");
  return `${base}${path}`;
}

export class BobProvider implements LlmProvider {
  async complete(opts: CompleteOptions): Promise<CompleteResult> {
    const model = process.env.BOB_MODEL;
    if (!model) throw new Error("BOB_MODEL is not set");

    const messages = opts.system
      ? [{ role: "system" as const, content: opts.system }, ...opts.messages]
      : opts.messages;

    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: opts.temperature ?? 0,
      stream: false,
    };

    if (opts.maxTokens) body.max_tokens = opts.maxTokens;

    if (opts.jsonSchema) {
      body.response_format = {
        type: "json_schema",
        json_schema: {
          name: "response",
          strict: true,
          schema: opts.jsonSchema,
        },
      };
    }

    const start = Date.now();
    const res = await fetch(buildUrl("/v1/chat/completions"), {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Bob API error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const text = data.choices[0]?.message?.content ?? "";
    return { text, latencyMs: Date.now() - start };
  }

  async *stream(opts: CompleteOptions): AsyncIterable<string> {
    const model = process.env.BOB_MODEL;
    if (!model) throw new Error("BOB_MODEL is not set");

    const messages = opts.system
      ? [{ role: "system" as const, content: opts.system }, ...opts.messages]
      : opts.messages;

    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: opts.temperature ?? 0,
      stream: true,
    };

    if (opts.maxTokens) body.max_tokens = opts.maxTokens;

    const res = await fetch(buildUrl("/v1/chat/completions"), {
      method: "POST",
      headers: buildHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Bob API error ${res.status}: ${text}`);
    }

    if (!res.body) return;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const raw = trimmed.slice(5).trim();
        if (raw === "[DONE]") return;
        try {
          const chunk = JSON.parse(raw) as {
            choices: Array<{ delta: { content?: string } }>;
          };
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // skip malformed chunk
        }
      }
    }
  }
}
