/**
 * LLM provider factory — returns the configured provider.
 */
import type { LlmProvider } from "./types";

let _provider: LlmProvider | null = null;

export function getLlmProvider(): LlmProvider {
  if (_provider) return _provider;

  const providerName = process.env.LLM_PROVIDER ?? "bob";
  if (providerName === "bob") {
    // Lazy import to avoid loading at build time
    const { BobProvider } = require("./bob-provider") as { BobProvider: new () => LlmProvider };
    _provider = new BobProvider();
  } else {
    throw new Error(`Unknown LLM provider: ${providerName}. Supported: bob`);
  }
  return _provider;
}

export type { LlmProvider, CompleteOptions, CompleteResult, ChatMessage } from "./types";
