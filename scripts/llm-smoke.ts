// Sends one small request to the configured LLM and prints latency and output.
// Use it to confirm the IBM Bob endpoint, headers and model before anything else.
import "./env";
import { getProvider, MockProvider } from "@/lib/llm/provider";

async function main() {
  const provider = getProvider();
  if (provider instanceof MockProvider) {
    console.error("No LLM configured. Fill BOB_BASE_URL, BOB_API_KEY and BOB_MODEL in .env.local (see .env.local.example).");
    process.exit(1);
  }
  console.log(`Provider: ${provider.name}`);
  const res = await provider.complete({
    messages: [
      { role: "system", content: 'Reply with JSON only: {"ok": true, "translation": "<English>"}' },
      { role: "user", content: "Translate: KM-Allergie (Übelkeit, Schwindel, Erbrechen)" },
    ],
    json: true,
    maxTokens: 100,
  });
  console.log(`Model: ${res.model}\nLatency: ${res.ms} ms\nOutput: ${res.text}`);
}

main().catch((err) => {
  console.error("Smoke test failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
