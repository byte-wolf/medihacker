export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type CompleteOptions = {
  messages: ChatMessage[];
  /** Ask the provider for a JSON object response */
  json?: boolean;
  /** Enforce this response shape where the provider supports structured output. */
  jsonSchema?: Record<string, unknown>;
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
  readonly cacheIdentity?: string;
  complete(opts: CompleteOptions): Promise<CompleteResult>;
}

export class LlmUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmUnavailableError";
  }
}

export class LlmRequestError extends Error {
  constructor(message: string, readonly status: number, readonly userMessage: string) {
    super(message);
    this.name = "LlmRequestError";
  }
}

export function llmErrorMessage(error: unknown, fallback: string): string {
  return error instanceof LlmRequestError ? error.userMessage : fallback;
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
 * IBM Bob's inference API is used through this adapter with its team/instance headers.
 */
export class OpenAiCompatibleProvider implements LlmProvider {
  readonly name: string;
  readonly cacheIdentity: string;
  constructor(private cfg: OpenAiConfig) {
    this.name = cfg.name;
    this.cacheIdentity = JSON.stringify([cfg.baseUrl, cfg.model, cfg.fastModel]);
  }

  async complete(opts: CompleteOptions): Promise<CompleteResult> {
    const model = (opts.fast && this.cfg.fastModel) || this.cfg.model;
    const started = Date.now();
    const timeout = AbortSignal.timeout(this.cfg.timeoutMs);
    const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
    const gemini = new URL(this.cfg.baseUrl).hostname === "generativelanguage.googleapis.com";
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
        // Gemini 2.5 otherwise spends the output budget on hidden reasoning,
        // leaving short JSON requests truncated. Other providers are unchanged.
        ...(gemini && /^gemini-2\.5-flash/.test(model)
          ? { reasoning_effort: "none" } : {}),
        ...(opts.jsonSchema && gemini
          ? { response_format: { type: "json_schema", json_schema: { name: "clinical_answer", strict: true, schema: opts.jsonSchema } } }
          : opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const daily = /perday|per_day|per day|daily/i.test(body);
      const userMessage = res.status === 429
        ? daily
          ? "The AI provider's daily quota is exhausted. Check your project's quota or wait for it to reset."
          : "The AI provider's quota has been reached. Wait a minute before trying again; if it continues, check your project's quota."
        : res.status === 401 || res.status === 403
          ? "The AI provider denied access. Check the configured key and project permissions."
          : "The AI provider could not complete this request. Please try again.";
      throw new LlmRequestError(`${this.name} request failed: HTTP ${res.status} ${body.split(this.cfg.apiKey).join("[REDACTED]").slice(0, 2000)}`, res.status, userMessage);
    }
    const data = (await res.json()) as { choices?: { finish_reason?: string; message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content ?? "";
    if (data.choices?.[0]?.finish_reason === "length" || !text.trim()) {
      throw new LlmRequestError("The model returned an empty or truncated response.", 502, "The AI response was incomplete. Please try again with a more specific question.");
    }
    if (opts.json || opts.jsonSchema) {
      try { parseJsonObject(text); }
      catch { throw new LlmRequestError("The model returned malformed JSON.", 502, "The AI response could not be read. Please try again."); }
    }
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

function parseHeaders(json: string | undefined): Record<string, string> {
  if (!json) return {};
  try {
    return JSON.parse(json) as Record<string, string>;
  } catch {
    return {};
  }
}

export function providerFromEnv(env: NodeJS.ProcessEnv = process.env): LlmProvider {
  const kind = (env.LLM_PROVIDER ?? "mock").toLowerCase();
  const timeoutMs = Number(env.LLM_TIMEOUT_MS ?? 30000);
  if (kind === "bob") {
    if (!env.BOB_BASE_URL || !env.BOB_API_KEY || !env.BOB_MODEL) {
      return new MockProvider();
    }
    return new OpenAiCompatibleProvider({
      name: "IBM Bob",
      baseUrl: env.BOB_BASE_URL,
      apiKey: env.BOB_API_KEY,
      model: env.BOB_MODEL,
      fastModel: env.BOB_FAST_MODEL || undefined,
      timeoutMs,
      headers: {
        ...(env.BOB_TEAM_ID ? { "x-team-id": env.BOB_TEAM_ID } : {}),
        ...(env.BOB_INSTANCE_ID ? { "x-instance-id": env.BOB_INSTANCE_ID } : {}),
        ...parseHeaders(env.BOB_EXTRA_HEADERS),
      },
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
