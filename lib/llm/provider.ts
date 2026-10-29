export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type CompleteOptions = {
  messages: ChatMessage[];
  /** Ask the provider for a JSON object response */
  json?: boolean;
  /** Use the faster/cheaper model, e.g. for planning and translation */
  fast?: boolean;
  temperature?: number;
  maxTokens?: number;
  /** Free-form tag used by the mock provider to pick a fixture and by logs */
  tag?: string;
  signal?: AbortSignal;
};

export type CompleteResult = { text: string; model: string; ms: number };

export interface LlmProvider {
  readonly name: string;
  complete(opts: CompleteOptions): Promise<CompleteResult>;
}

export class LlmUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmUnavailableError";
  }
}

type OpenAiConfig = {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  fastModel?: string;
  headers?: Record<string, string>;
  timeoutMs: number;
};

/**
 * Adapter for OpenAI-compatible `chat/completions` endpoints.
 * Gemini is used through Google's OpenAI-compatible endpoint.
 */
export class OpenAiCompatibleProvider implements LlmProvider {
  readonly name: string;
  constructor(private cfg: OpenAiConfig) {
    this.name = cfg.name;
  }

  async complete(opts: CompleteOptions): Promise<CompleteResult> {
    const model = (opts.fast && this.cfg.fastModel) || this.cfg.model;
    const started = Date.now();
    const timeout = AbortSignal.timeout(this.cfg.timeoutMs);
    const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
    const res = await fetch(`${this.cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.cfg.apiKey}`,
        ...this.cfg.headers,
      },
      body: JSON.stringify({
        model,
        messages: opts.messages,
        temperature: opts.temperature ?? 0,
        max_tokens: opts.maxTokens ?? 4000,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`${this.name} request failed: HTTP ${res.status} ${body.slice(0, 300)}`);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content ?? "";
    return { text, model, ms: Date.now() - started };
  }
}

/** Mock provider: answers from a handler (tests) or reports itself unavailable (app falls back to retrieval). */
export class MockProvider implements LlmProvider {
  readonly name = "mock";
  constructor(private handler?: (opts: CompleteOptions) => string | Promise<string>) {}
  async complete(opts: CompleteOptions): Promise<CompleteResult> {
    if (!this.handler) throw new LlmUnavailableError("No LLM configured (LLM_PROVIDER=mock).");
    const started = Date.now();
    const text = await this.handler(opts);
    return { text, model: "mock", ms: Date.now() - started };
  }
}

export function providerFromEnv(env: NodeJS.ProcessEnv = process.env): LlmProvider {
  const kind = (env.LLM_PROVIDER ?? "mock").toLowerCase();
  const timeoutMs = Number(env.LLM_TIMEOUT_MS ?? 30000);
  if (kind === "gemini") {
    if (!env.GEMINI_API_KEY || !env.GEMINI_MODEL) return new MockProvider();
    return new OpenAiCompatibleProvider({
      name: "Gemini",
      // Google's OpenAI-compatible endpoint for the Gemini API
      baseUrl: env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL,
      fastModel: env.GEMINI_FAST_MODEL || undefined,
      timeoutMs,
    });
  }
  if (kind === "openai-compatible") {
    if (!env.LLM_BASE_URL || !env.LLM_API_KEY || !env.LLM_MODEL) return new MockProvider();
    return new OpenAiCompatibleProvider({
      name: "LLM",
      baseUrl: env.LLM_BASE_URL,
      apiKey: env.LLM_API_KEY,
      model: env.LLM_MODEL,
      fastModel: env.LLM_FAST_MODEL || undefined,
      timeoutMs,
    });
  }
  return new MockProvider();
}

let override: LlmProvider | null = null;

/** Tests can swap the provider. */
export function setProvider(p: LlmProvider | null) {
  override = p;
}

export function getProvider(): LlmProvider {
  return override ?? providerFromEnv();
}

/** True when a real model is configured (not the mock fallback). */
export function llmConfigured(): boolean {
  const p = getProvider();
  return !(p instanceof MockProvider) || override !== null;
}

/** Parse a JSON object from model output, tolerating code fences and leading prose. */
export function parseJsonObject<T = unknown>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model response contained no JSON object");
  return JSON.parse(body.slice(start, end + 1)) as T;
}
