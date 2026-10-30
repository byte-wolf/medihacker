import type { PatientRecord } from "@/lib/data/patients";
import { listContradictions } from "@/lib/contradictions/store";
import { itemsFromModel, verifyContext } from "@/lib/briefing/items";
import { cachedComplete } from "@/lib/llm/cache";
import { TOKEN_LIMITS } from "@/lib/llm/tokens";
import { LlmUnavailableError, parseJsonObject } from "@/lib/llm/provider";
import { chatPrompt } from "@/lib/llm/prompts";
import type { BriefingItem, RejectedFact } from "@/lib/types";

export type ChatTurn = { role: "user" | "assistant"; text: string };

/** Short plain-text version of an answer, used as conversation history for follow-up questions. */
export function summarizeItems(items: BriefingItem[]): string {
  return items
    .map((i) => `${i.label}: ${i.facts.length ? i.facts.map((f) => f.statement).join(" ") : (i.note ?? i.status)}`)
    .join("\n");
}

export async function answerQuestion(args: {
  patient: PatientRecord;
  roles: string[];
  situation: { title: string; description: string } | null;
  history: ChatTurn[];
  question: string;
}): Promise<{ items: BriefingItem[]; rejected: RejectedFact[]; ms: number }> {
  const started = Date.now();
  try {
    const { system, user } = chatPrompt(args);
    const { text } = await cachedComplete({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      json: true,
      tag: "chat",
      maxTokens: TOKEN_LIMITS.chat,
    });
    const { items, rejected } = itemsFromModel(parseJsonObject(text), [], verifyContext(args.patient), "chat");
    const contradictions = listContradictions(args.patient.id);
    for (const item of items)
      for (const fact of item.facts) {
        const ids = contradictions.filter((c) => fact.quotes.some((q) => c.passageIds.includes(q.passageId))).map((c) => c.id);
        if (ids.length) fact.contradictionIds = ids;
      }
    return { items, rejected, ms: Date.now() - started };
  } catch (err) {
    if (!(err instanceof LlmUnavailableError)) throw err;
    return {
      items: [
        {
          key: "unavailable",
          label: "AI model not configured",
          status: "unverified",
          facts: [],
          note: "Free-text questions need the AI model. Configure the LLM in .env.local and try again.",
        },
      ],
      rejected: [],
      ms: Date.now() - started,
    };
  }
}
