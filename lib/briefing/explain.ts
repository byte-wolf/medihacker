import { cachedComplete } from "@/lib/llm/cache";
import { parseJsonObject } from "@/lib/llm/provider";
import { explainPrompt } from "@/lib/llm/prompts";

export type Explanation = { why: string; guideline: { title: string; url: string } | null };

/** Guideline publishers whose links are shown as-is; other links become a search for the guideline title. */
const GUIDELINE_HOSTS = [
  "awmf.org",
  "nice.org.uk",
  "escardio.org",
  "esaic.org",
  "nccn.org",
  "who.int",
  "ncbi.nlm.nih.gov",
  "esmo.org",
  "kdigo.org",
  "ahajournals.org",
  "diabetes.org",
  "leitlinienprogramm-onkologie.de",
];

export const EXPLAIN_MAX_TOKENS = 400;
export const EXPLAIN_TIMEOUT_MS = 8000;

function safeGuideline(g: unknown): Explanation["guideline"] {
  if (!g || typeof g !== "object") return null;
  const { title, url } = g as { title?: unknown; url?: unknown };
  if (typeof title !== "string" || !title.trim()) return null;
  try {
    const u = new URL(String(url));
    if (u.protocol === "https:" && GUIDELINE_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))) return { title, url: u.toString() };
  } catch {
    // fall through to a search link
  }
  return { title, url: `https://www.google.com/search?q=${encodeURIComponent(`${title} guideline`)}` };
}

/**
 * Why one briefing item matters for this role and situation. Cached by prompt (= per role,
 * situation and item); capped by tokens and time so the modal never waits long.
 */
export async function explainItem(args: { roles: string[]; situation: { title: string; description: string }; label: string }): Promise<Explanation> {
  const { system, user } = explainPrompt(args);
  const { text } = await cachedComplete({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    json: true,
    fast: true,
    tag: "explain",
    maxTokens: EXPLAIN_MAX_TOKENS,
    signal: AbortSignal.timeout(EXPLAIN_TIMEOUT_MS),
  });
  const data = parseJsonObject<{ why?: unknown; guideline?: unknown }>(text);
  const why = typeof data.why === "string" ? data.why.trim() : "";
  if (!why) throw new Error("Empty explanation");
  return { why, guideline: safeGuideline(data.guideline) };
}
