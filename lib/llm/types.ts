/**
 * LlmProvider interface — all providers implement this.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompleteOptions {
  system?: string;
  messages: ChatMessage[];
  /** JSON schema for structured output (passed as response_format). */
  jsonSchema?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
}

export interface CompleteResult {
  text: string;
  latencyMs: number;
}

export interface LlmProvider {
  complete(opts: CompleteOptions): Promise<CompleteResult>;
  /** Returns a readable stream of text deltas. */
  stream(opts: CompleteOptions): AsyncIterable<string>;
}
