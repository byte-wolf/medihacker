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
  /** Model, or an ordered fallback list ("a,b,c"): the next one is tried when a model fails */
  model: string;
  fastModel?: string;
  /** Max time one model gets before the next one is tried */
  perModelTimeoutMs?: number;
  headers?: Record<string, string>;
  /** Extra request fields, e.g. OpenRouter's `reasoning` settings */
  extraBody?: Record<string, unknown>;
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

/** A failure of one model (refused, rate-limited, timed out, unusable answer): try the next model. */
class ModelFailure extends Error {
  constructor(
    message: string,
    readonly cooldownMs: number,
    readonly delayMs = 0,
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry delay from a Retry-After header, else a short backoff. */
function retryDelayMs(res: Response): number {
  const header = Number(res.headers.get("retry-after"));
  return Math.min(Number.isFinite(header) && header > 0 ? header * 1000 : 1500, 10_000);
}

const list = (v: string | undefined) => (v ?? "").split(",").map((m) => m.trim()).filter(Boolean);

/**
 * Adapter for OpenAI-compatible `chat/completions` endpoints (OpenRouter and others).
 * Requests are queued. Each request walks an ordered model list: when a model refuses
 * (e.g. excluded by a zero-data-retention rule), is rate-limited, times out or returns
 * a cut-off, empty or non-JSON answer, the next model is tried and the failing one is
 * skipped for a while. A failed answer is never returned half-finished.
 */
export class OpenAiCompatibleProvider implements LlmProvider {
  readonly name: string;
  private limiter: Limiter;
  private coolingUntil = new Map<string, number>();
  constructor(private cfg: OpenAiConfig) {
    this.name = cfg.name;
    this.limiter = new Limiter(cfg.maxConcurrency ?? 6);
  }

  async complete(opts: CompleteOptions): Promise<CompleteResult> {
    return this.limiter.run(() => this.completeWithFallback(opts));
  }

  /** Models to try, healthy ones first, in configured order. */
  private candidates(fast: boolean): string[] {
    const models = (fast && list(this.cfg.fastModel).length ? list(this.cfg.fastModel) : list(this.cfg.model));
    const now = Date.now();
    const healthy = models.filter((m) => (this.coolingUntil.get(m) ?? 0) <= now);
    return [...healthy, ...models.filter((m) => !healthy.includes(m))];
  }

  private async completeWithFallback(opts: CompleteOptions): Promise<CompleteResult> {
    const deadline = Date.now() + this.cfg.timeoutMs;
    const errors: string[] = [];
    // Two passes: if every model failed, wait briefly once and try the list again.
    for (let pass = 0; pass < 2; pass++) {
      let wait = 0;
      for (const model of this.candidates(!!opts.fast)) {
        if (deadline - Date.now() < 2000) break;
        try {
          return await this.request(opts, model, Math.min(deadline, Date.now() + (this.cfg.perModelTimeoutMs ?? 20_000)));
        } catch (err) {
          if (!(err instanceof ModelFailure)) throw err;
          if (process.env.LLM_DEBUG) console.log(`[llm] ${opts.tag ?? ""} FAILED ${err.message.slice(0, 160)}`);
          errors.push(err.message);
          this.coolingUntil.set(model, Date.now() + err.cooldownMs);
          wait = Math.max(wait, err.delayMs);
        }
      }
      if (pass === 0 && Date.now() + Math.max(wait, 1000) < deadline - 2000) await sleep(Math.max(wait, 1000));
      else break;
    }
    throw new Error(`${this.name}: no model answered. ${errors.join(" | ").slice(0, 600)}`);
  }

  private async request(opts: CompleteOptions, model: string, deadline: number): Promise<CompleteResult> {
    const started = Date.now();
    const timeout = AbortSignal.timeout(Math.max(1000, deadline - Date.now()));
    const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
    let res: Response;
    try {
      res = await fetch(`${this.cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
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
          ...this.cfg.extraBody,
        }),
      });
    } catch (err) {
      if (opts.signal?.aborted) throw err;
      throw new ModelFailure(`${model}: no answer in time (${err instanceof Error ? err.name : "error"})`, 30_000);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const message = `${model}: HTTP ${res.status} ${body.slice(0, 200)}`;
      // Key or account problems affect every model: stop instead of walking the list.
      if (res.status === 401 || res.status === 402 || res.status === 403) throw new Error(`${this.name} request failed: ${message}`);
      throw new ModelFailure(message, res.status === 429 ? 60_000 : 120_000, res.status === 429 ? retryDelayMs(res) : 0);
    }
    const data = (await res.json()) as {
      model?: string;
      error?: { message?: string };
      choices?: { message?: { content?: string | null }; finish_reason?: string }[];
    };
    const answeredBy = data.model ?? model;
    // Gateways can report upstream failures inside a 200 response.
    if (data.error) throw new ModelFailure(`${model}: upstream error ${data.error.message ?? ""}`.trim(), 30_000, 1000);
    const choice = data.choices?.[0];
    if (choice?.finish_reason === "length") {
      if (process.env.LLM_DEBUG) console.log(`[llm] cut-off answer from ${answeredBy}, ${choice.message?.content?.length ?? 0} chars, ends with: ${(choice.message?.content ?? "").slice(-300).replace(/\s+/g, " ")}`);
      throw new ModelFailure(`${answeredBy}: answer was cut off at max_tokens`, 0);
    }
    const text = choice?.message?.content ?? "";
    if (!text.trim()) throw new ModelFailure(`${answeredBy}: empty answer`, 30_000);
    if (opts.json) {
      try {
        parseJsonObject(text);
      } catch {
        throw new ModelFailure(`${answeredBy}: answer was not valid JSON`, 0);
      }
    }
    if (process.env.LLM_DEBUG) console.log(`[llm] ${opts.tag ?? ""} ok ${answeredBy} ${Date.now() - started} ms`);
    return { text, model: answeredBy, ms: Date.now() - started };
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
  const maxConcurrency = Number(env.LLM_MAX_CONCURRENCY ?? 12);
  if (kind === "openrouter") {
    if (!env.OPENROUTER_API_KEY) return new MockProvider();
    return new OpenAiCompatibleProvider({
      name: "OpenRouter",
      baseUrl: env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
      apiKey: env.OPENROUTER_API_KEY,
      model: env.OPENROUTER_MODEL || "openrouter/free",
      perModelTimeoutMs: Number(env.LLM_MODEL_TIMEOUT_MS ?? 20_000),
      fastModel: env.OPENROUTER_FAST_MODEL || undefined,
      timeoutMs,
      maxConcurrency,
      // Optional attribution headers OpenRouter shows in its dashboard
      headers: { "X-Title": "MediHacker" },
      // Hidden reasoning counts against max_tokens; keep it short so answers are not cut off.
      extraBody: { reasoning: { effort: env.OPENROUTER_REASONING_EFFORT || "minimal" } },
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
