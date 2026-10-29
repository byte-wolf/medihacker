/**
 * translate.ts — Translate German passages to English and cache them.
 *
 * Uses the LLM to translate. Results are stored in the passages table
 * (translation column). We batch passages to keep prompts manageable.
 */
import type { LlmProvider } from "../llm/types";

const BATCH_SIZE = 20;

interface PassageInput {
  id: string;
  text: string;
}

interface TranslationResult {
  id: string;
  translation: string;
}

export async function translatePassages(
  passages: PassageInput[],
  llm: LlmProvider
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  for (let i = 0; i < passages.length; i += BATCH_SIZE) {
    const batch = passages.slice(i, i + BATCH_SIZE);
    const input = batch
      .map((p, idx) => `[${idx}] ${p.text}`)
      .join("\n");

    const schema = {
      type: "object",
      properties: {
        translations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              index: { type: "integer" },
              translation: { type: "string" },
            },
            required: ["index", "translation"],
            additionalProperties: false,
          },
        },
      },
      required: ["translations"],
      additionalProperties: false,
    };

    try {
      const { text } = await llm.complete({
        system:
          "You are a medical translator. Translate the following German clinical text passages to clear English. Preserve medical terminology. Return JSON only.",
        messages: [
          {
            role: "user",
            content: `Translate each passage and return JSON matching the schema.\n\nPassages:\n${input}`,
          },
        ],
        jsonSchema: schema,
        temperature: 0,
      });

      const parsed = JSON.parse(text) as {
        translations: Array<{ index: number; translation: string }>;
      };

      for (const t of parsed.translations) {
        if (t.index >= 0 && t.index < batch.length) {
          result.set(batch[t.index].id, t.translation);
        }
      }
    } catch (err) {
      console.error(`Translation batch ${i / BATCH_SIZE} failed:`, err);
      // On failure, fall back to original text
      for (const p of batch) {
        result.set(p.id, p.text);
      }
    }
  }

  return result;
}
