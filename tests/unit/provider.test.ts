import { afterEach, describe, expect, it, vi } from "vitest";
import { MockProvider, OpenAiCompatibleProvider, providerFromEnv } from "@/lib/llm/provider";

const env = (e: Record<string, string>) => e as unknown as NodeJS.ProcessEnv;

describe("providerFromEnv", () => {
  it("uses OpenRouter with the free router model by default", () => {
    const p = providerFromEnv(env({ LLM_PROVIDER: "openrouter", OPENROUTER_API_KEY: "k" }));
    expect(p).toBeInstanceOf(OpenAiCompatibleProvider);
    expect(p.name).toBe("OpenRouter");
  });

  it("falls back to keyword mode without a key", () => {
    expect(providerFromEnv(env({ LLM_PROVIDER: "openrouter" }))).toBeInstanceOf(MockProvider);
  });
});

describe("OpenAiCompatibleProvider", () => {
  afterEach(() => vi.unstubAllGlobals());
  const provider = () =>
    new OpenAiCompatibleProvider({ name: "Test", baseUrl: "https://x.test/v1", apiKey: "k", model: "m", timeoutMs: 10_000 });
  const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

  it("retries a rate limit and reports the model that answered", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ error: { message: "rate limited" } }, 429, { "retry-after": "0.01" }))
      .mockResolvedValueOnce(json({ model: "vendor/free-model", choices: [{ message: { content: '{"ok":true}' }, finish_reason: "stop" }] }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await provider().complete({ messages: [{ role: "user", content: "hi" }] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(r.model).toBe("vendor/free-model");
  });

  it("rejects an answer that was cut off", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ choices: [{ message: { content: '{"items": [' }, finish_reason: "length" }] })));
    await expect(provider().complete({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(/cut off/);
  });
});
