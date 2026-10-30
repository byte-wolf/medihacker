// Sends one small request to the configured LLM and prints latency and output.
// Use it to confirm the endpoint, key and model before anything else.
import "./env";
import { translationIsSafe } from "@/lib/llm/glossary";
import { translationPrompt } from "@/lib/llm/prompts";
import { getProvider, MockProvider, parseJsonObject } from "@/lib/llm/provider";

async function main() {
  const provider = getProvider();
  if (provider instanceof MockProvider) {
    console.error("No LLM configured. Set LLM_PROVIDER=openrouter and OPENROUTER_API_KEY in .env (see .env.local.example).");
    process.exit(1);
  }
  console.log(`Provider: ${provider.name}`);
  // The app's own translation prompt on a CAVE line: KM means contrast medium, not cow's milk.
  const source = "KM-Allergie (Übelkeit, Schwindel, Erbrechen)";
  const { system, user } = translationPrompt([{ id: "smoke:p001", docId: "smoke", section: "Allergien", kind: "line", text: source, start: 0, end: source.length }]);
  const res = await provider.complete({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    json: true,
    maxTokens: 1000,
  });
  console.log(`Model: ${res.model}\nLatency: ${res.ms} ms\nOutput: ${res.text}`);
  const translation = parseJsonObject<{ translations?: Record<string, string> }>(res.text).translations?.["smoke:p001"] ?? "";
  if (!translationIsSafe(source, translation) || !/contrast/i.test(translation)) {
    console.error(`Wrong translation of "KM" (expected contrast medium): ${translation}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Smoke test failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
