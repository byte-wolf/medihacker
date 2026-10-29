import { describe, expect, it } from "vitest";
import { MockProvider, OpenAiCompatibleProvider, providerFromEnv } from "@/lib/llm/provider";

describe("providerFromEnv", () => {
  it("uses Gemini when key and model are set", () => {
    const p = providerFromEnv({ LLM_PROVIDER: "gemini", GEMINI_API_KEY: "k", GEMINI_MODEL: "m" } as unknown as NodeJS.ProcessEnv);
    expect(p).toBeInstanceOf(OpenAiCompatibleProvider);
    expect(p.name).toBe("Gemini");
  });

  it("falls back to keyword mode when Gemini is not fully configured", () => {
    expect(providerFromEnv({ LLM_PROVIDER: "gemini", GEMINI_API_KEY: "k" } as unknown as NodeJS.ProcessEnv)).toBeInstanceOf(MockProvider);
  });
});
