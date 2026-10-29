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
 * IBM Bob's inference API is used through this adapter with its team/instance headers.
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

type DevinConfig = {
  apiUrl: string;
  apiKey: string;
  orgId: string;
  mode: string;
  fastMode?: string;
  maxAcuLimit?: number;
  pollMs: number;
  timeoutMs: number;
};

type DevinSession = {
  session_id: string;
  url?: string;
  status: string;
  status_detail?: string | null;
  structured_output?: { text?: unknown } | null;
};

const DEVIN_OUTPUT_SCHEMA = {
  type: "object",
  properties: { text: { type: "string" } },
  required: ["text"],
  additionalProperties: false,
};

const DEVIN_DONE_DETAILS = new Set(["finished", "waiting_for_user"]);

/** Flattens chat messages into one Devin session prompt that asks for the reply as structured output. */
export function devinPrompt(opts: CompleteOptions): string {
  const parts = [
    "You are being used as a plain text-completion backend. Do not run commands, browse, open files, or create pull requests.",
    "Read the messages below and write the assistant reply. Return it only through the structured output tool, with the full reply in the `text` field.",
    opts.json ? "The `text` field must contain a single JSON object as a string, with no code fences or prose." : "",
  ].filter(Boolean);
  for (const m of opts.messages) parts.push(`<${m.role}>\n${m.content}\n</${m.role}>`);
  return parts.join("\n\n");
}

/**
 * Adapter for the Devin API (v3). Each completion runs as a short Devin session (Lite mode by default)
 * that returns the reply as structured output; the session is terminated afterwards.
 */
export class DevinProvider implements LlmProvider {
  readonly name = "Devin";
  constructor(private cfg: DevinConfig) {}

  private async request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
    const res = await fetch(`${this.cfg.apiUrl.replace(/\/$/, "")}/v3/organizations/${this.cfg.orgId}${path}`, {
      method,
      signal,
      headers: { authorization: `Bearer ${this.cfg.apiKey}`, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Devin API ${method} ${path} failed: HTTP ${res.status} ${text.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  }

  async complete(opts: CompleteOptions): Promise<CompleteResult> {
    const mode = (opts.fast && this.cfg.fastMode) || this.cfg.mode;
    const model = `devin-${mode}`;
    const started = Date.now();
    const timeout = AbortSignal.timeout(this.cfg.timeoutMs);
    const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
    const session = await this.request<DevinSession>(
      "POST",
      "/sessions",
      {
        prompt: devinPrompt(opts),
        devin_mode: mode,
        title: `medihacker ${opts.tag ?? "completion"}`,
        tags: ["medihacker"],
        structured_output_schema: DEVIN_OUTPUT_SCHEMA,
        structured_output_required: true,
        knowledge_ids: [],
        secret_ids: [],
        resumable: false,
        ...(this.cfg.maxAcuLimit ? { max_acu_limit: this.cfg.maxAcuLimit } : {}),
      },
      signal,
    );
    try {
      for (;;) {
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(resolve, this.cfg.pollMs);
          signal.addEventListener("abort", () => (clearTimeout(t), reject(signal.reason)), { once: true });
        });
        const s = await this.request<DevinSession>("GET", `/sessions/${session.session_id}`, undefined, signal);
        const text = s.structured_output?.text;
        const done = s.status === "exit" || DEVIN_DONE_DETAILS.has(s.status_detail ?? "");
        if (typeof text === "string" && done) return { text, model, ms: Date.now() - started };
        if (done || s.status === "error" || s.status === "suspended") {
          throw new Error(`Devin session ${session.session_id} ended without output (status ${s.status}${s.status_detail ? `/${s.status_detail}` : ""})`);
        }
      }
    } finally {
      await this.request("DELETE", `/sessions/${session.session_id}?archive=true`).catch((err) =>
        console.error("[devin] could not terminate session:", err),
      );
    }
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
  if (kind === "devin") {
    if (!env.DEVIN_API_KEY || !env.DEVIN_ORG_ID) return new MockProvider();
    return new DevinProvider({
      apiUrl: env.DEVIN_API_URL || "https://api.devin.ai",
      apiKey: env.DEVIN_API_KEY,
      orgId: env.DEVIN_ORG_ID,
      mode: env.DEVIN_MODE || "lite",
      fastMode: env.DEVIN_FAST_MODE || undefined,
      maxAcuLimit: env.DEVIN_MAX_ACU_LIMIT ? Number(env.DEVIN_MAX_ACU_LIMIT) : undefined,
      pollMs: Number(env.DEVIN_POLL_MS ?? 3000),
      timeoutMs: Number(env.DEVIN_TIMEOUT_MS ?? 600000),
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
