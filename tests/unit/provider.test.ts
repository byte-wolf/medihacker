import { afterEach, describe, expect, it, vi } from "vitest";
import { LlmRequestError, OpenAiCompatibleProvider, llmErrorMessage } from "@/lib/llm/provider";

afterEach(() => vi.unstubAllGlobals());
const options = { messages: [{ role: "user" as const, content: "Return JSON." }], json: true, maxTokens: 100 };
function provider(baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai") {
  return new OpenAiCompatibleProvider({ name: "test", baseUrl, apiKey: "test-secret", model: "gemini-2.5-flash", timeoutMs: 5000 });
}

describe("model responses", () => {
  it("sends an enforced schema to Gemini while preserving other providers' JSON mode", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ choices: [{ message: { content: '{"ok":true}' }, finish_reason: "stop" }] }));
    vi.stubGlobal("fetch", fetcher);
    const schema = { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] };
    await provider().complete({ ...options, jsonSchema: schema });
    expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string).response_format).toMatchObject({ type: "json_schema", json_schema: { strict: true, schema } });
    await provider("https://other.example/v1").complete({ ...options, jsonSchema: schema });
    expect(JSON.parse(fetcher.mock.calls[1][1]!.body as string).response_format).toEqual({ type: "json_object" });
  });
  it("preserves the JSON output budget on Gemini 2.5 without changing other endpoints", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ choices: [{ message: { content: '{"ok":true}' }, finish_reason: "stop" }] }));
    vi.stubGlobal("fetch", fetcher);
    await provider().complete(options);
    expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string).reasoning_effort).toBe("none");
    await provider("https://other.example/v1").complete(options);
    expect(JSON.parse(fetcher.mock.calls[1][1]!.body as string).reasoning_effort).toBeUndefined();
  });

  it.each(["length", "stop"])("rejects incomplete JSON (finish reason %s)", async (finish_reason) => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ choices: [{ message: { content: '{"items":[' }, finish_reason }] })));
    await expect(provider().complete(options)).rejects.toThrow();
  });

  it("keeps daily quota errors actionable and redacts credentials in diagnostics", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([{ error: { message: "quota GenerateRequestsPerDay exhausted test-secret" } }], { status: 429 })));
    const error = await provider().complete(options).catch((e) => e);
    expect(error).toBeInstanceOf(LlmRequestError);
    expect(error.status).toBe(429);
    expect(error.message).not.toContain("test-secret");
    expect(llmErrorMessage(error, "fallback")).toContain("daily quota");
  });
});
