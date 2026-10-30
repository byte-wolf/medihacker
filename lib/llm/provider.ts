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
  /** Max parallel requests; the rest wait (protects per-minute rate limits). */
  maxConcurrency?: number;
};

/** Small FIFO semaphore so bursts (parallel sections, background jobs) queue instead of hitting rate limits. */
class Limiter {
  private active = 0;
  private queue: (() => void)[] = [];
  constructor(private max: number) {}
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      this.queue.shift()?.();
    }
  }
}

class RetryableError extends Error {
  constructor(
    message: string,
    readonly delayMs: number,
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry delay from a Retry-After header, else a short backoff. */
function retryDelayMs(res: Response, attempt: number): number {
  const header = Number(res.headers.get("retry-after"));
  return Math.min(Number.isFinite(header) && header > 0 ? header * 1000 : 1500 * attempt, 10_000);
}

/**
 * Adapter for OpenAI-compatible `chat/completions` endpoints (OpenRouter and others).
 * Requests are queued, rate limits and overloads are retried within the timeout,
 * and a cut-off or empty answer is an error, never half a result.
 */
export class OpenAiCompatibleProvider implements LlmProvider {
  readonly name: string;
  private limiter: Limiter;
  constructor(private cfg: OpenAiConfig) {
    this.name = cfg.name;
    this.limiter = new Limiter(cfg.maxConcurrency ?? 6);
  }

  async complete(opts: CompleteOptions): Promise<CompleteResult> {
    return this.limiter.run(() => this.completeWithRetry(opts));
  }

  private async completeWithRetry(opts: CompleteOptions): Promise<CompleteResult> {
    const deadline = Date.now() + this.cfg.timeoutMs;
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.request(opts, deadline, attempt);
      } catch (err) {
        const retry = err instanceof RetryableError && attempt < 3 && Date.now() + err.delayMs < deadline - 2000;
        if (!retry) throw err instanceof RetryableError ? new Error(err.message) : err;
        await sleep(err.delayMs);
      }
    }
  }

  private async request(opts: CompleteOptions, deadline: number, attempt: number): Promise<CompleteResult> {
    const model = (opts.fast && this.cfg.fastModel) || this.cfg.model;
    const started = Date.now();
    const timeout = AbortSignal.timeout(Math.max(1000, deadline - Date.now()));
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
      const message = `${this.name} request failed: HTTP ${res.status} ${body.slice(0, 300)}`;
      if (res.status === 429 || res.status === 502 || res.status === 503) throw new RetryableError(message, retryDelayMs(res, attempt));
      throw new Error(message);
    }
    const data = (await res.json()) as {
      model?: string;
      error?: { message?: string };
      choices?: { message?: { content?: string | null }; finish_reason?: string }[];
    };
    // Some gateways report upstream failures inside a 200 response.
    if (data.error) throw new RetryableError(`${this.name} upstream error: ${data.error.message ?? "unknown"}`, 1500 * attempt);
    const choice = data.choices?.[0];
    if (choice?.finish_reason === "length") throw new Error(`${this.name} answer was cut off at max_tokens (${data.model ?? model})`);
    const text = choice?.message?.content ?? "";
    if (!text.trim()) throw new RetryableError(`${this.name} returned an empty answer (${data.model ?? model})`, 1000);
    // With a router model (e.g. openrouter/free) the response names the model that actually answered.
    return { text, model: data.model ?? model, ms: Date.now() - started };
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
  const maxConcurrency = Number(env.LLM_MAX_CONCURRENCY ?? 6);
  if (kind === "openrouter") {
    if (!env.OPENROUTER_API_KEY) return new MockProvider();
    return new OpenAiCompatibleProvider({
      name: "OpenRouter",
      baseUrl: env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
      apiKey: env.OPENROUTER_API_KEY,
      model: env.OPENROUTER_MODEL || "openrouter/free",
      fastModel: env.OPENROUTER_FAST_MODEL || undefined,
      timeoutMs,
      maxConcurrency,
      // Optional attribution headers OpenRouter shows in its dashboard
      headers: { "X-Title": "MediHacker" },
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
      maxConcurrency,
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
