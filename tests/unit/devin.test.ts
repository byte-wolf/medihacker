import { afterEach, describe, expect, it, vi } from "vitest";
import { DevinProvider, MockProvider, devinPrompt, providerFromEnv } from "@/lib/llm/provider";

const cfg = { apiUrl: "https://api.example.test/", apiKey: "k", orgId: "org-1", mode: "lite", fastMode: "fast", pollMs: 1, timeoutMs: 5000 };

function mockFetch(polls: object[]) {
  const calls: { method: string; url: string; body?: Record<string, unknown> }[] = [];
  let i = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ method: init.method!, url, body: init.body ? JSON.parse(String(init.body)) : undefined });
      const payload = init.method === "POST" ? { session_id: "devin-abc", status: "new" } : init.method === "GET" ? polls[Math.min(i++, polls.length - 1)] : {};
      return new Response(JSON.stringify(payload), { status: 200 });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("DevinProvider", () => {
  it("creates a lite session, polls for structured output and terminates the session", async () => {
    const calls = mockFetch([
      { session_id: "devin-abc", status: "running", status_detail: "working", structured_output: null },
      { session_id: "devin-abc", status: "running", status_detail: "finished", structured_output: { text: '{"ok":true}' } },
    ]);
    const res = await new DevinProvider(cfg).complete({ messages: [{ role: "user", content: "hi" }], json: true, tag: "plan" });
    expect(res).toMatchObject({ text: '{"ok":true}', model: "devin-lite" });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST https://api.example.test/v3/organizations/org-1/sessions",
      "GET https://api.example.test/v3/organizations/org-1/sessions/devin-abc",
      "GET https://api.example.test/v3/organizations/org-1/sessions/devin-abc",
      "DELETE https://api.example.test/v3/organizations/org-1/sessions/devin-abc?archive=true",
    ]);
    expect(calls[0].body).toMatchObject({ devin_mode: "lite", knowledge_ids: [], secret_ids: [], resumable: false, structured_output_required: true });
  });

  it("uses the fast mode for fast calls", async () => {
    const calls = mockFetch([{ session_id: "devin-abc", status: "exit", structured_output: { text: "x" } }]);
    const res = await new DevinProvider(cfg).complete({ messages: [{ role: "user", content: "hi" }], fast: true });
    expect(res.model).toBe("devin-fast");
    expect(calls[0].body).toMatchObject({ devin_mode: "fast" });
  });

  it("fails and still terminates when the session ends without output", async () => {
    const calls = mockFetch([{ session_id: "devin-abc", status: "suspended", status_detail: "out_of_credits", structured_output: null }]);
    await expect(new DevinProvider(cfg).complete({ messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(/without output/);
    expect(calls.at(-1)?.method).toBe("DELETE");
  });

  it("builds a prompt with every message and the JSON instruction", () => {
    const p = devinPrompt({ messages: [{ role: "system", content: "S" }, { role: "user", content: "U" }], json: true });
    expect(p).toContain("<system>\nS\n</system>");
    expect(p).toContain("<user>\nU\n</user>");
    expect(p).toMatch(/single JSON object/);
  });

  it("is selected by LLM_PROVIDER=devin only when key and org are set", () => {
    expect(providerFromEnv({ LLM_PROVIDER: "devin", DEVIN_API_KEY: "k" } as unknown as NodeJS.ProcessEnv)).toBeInstanceOf(MockProvider);
    expect(providerFromEnv({ LLM_PROVIDER: "devin", DEVIN_API_KEY: "k", DEVIN_ORG_ID: "org-1" } as unknown as NodeJS.ProcessEnv)).toBeInstanceOf(DevinProvider);
  });
});
