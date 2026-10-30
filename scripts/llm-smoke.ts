// Sends one small request to the configured LLM and prints latency and output.
// Use it to confirm the IBM Bob endpoint, headers and model before anything else.
import "./env";
import { getProvider, MockProvider, parseJsonObject } from "@/lib/llm/provider";

async function main() {
  const provider = getProvider();
  if (provider instanceof MockProvider) {
    console.error("No LLM configured. Check the provider, endpoint, key and model in .env.local (see .env.local.example).");
    process.exit(1);
  }
  console.log(`Provider: ${provider.name}`);
  const res = await provider.complete({
    messages: [
      { role: "system", content: 'Reply with JSON only: {"ok": true, "translation": "<English>"}' },
      { role: "user", content: "Translate this German radiology note (KM means Kontrastmittel): KM-Allergie (Übelkeit, Schwindel, Erbrechen)" },
    ],
    json: true,
    maxTokens: 500,
  });
  const output = parseJsonObject<{ ok?: boolean; translation?: string }>(res.text);
  if (output.ok !== true || !output.translation?.trim()) throw new Error("Model returned an invalid connection-check response.");
  console.log(`Model: ${res.model}\nLatency: ${res.ms} ms\nOutput: ${JSON.stringify(output)}`);
}

main().catch((err) => {
  console.error("Smoke test failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
