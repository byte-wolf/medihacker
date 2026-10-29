/**
 * llm-smoke.ts — 20-line smoke test for the Bob inference API.
 * Sends one chat request and prints latency + first 200 chars of output.
 * Run with: npm run llm-smoke
 */
import "dotenv/config";
import { BobProvider } from "../lib/llm/bob-provider";

async function main() {
  const required = ["BOB_API_KEY", "BOB_BASE_URL", "BOB_MODEL"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`❌  Missing env vars: ${missing.join(", ")}`);
    console.error("    Copy .env.local.example → .env.local and fill in the values.");
    process.exit(1);
  }

  console.log(`Provider  : IBM Bob`);
  console.log(`Base URL  : ${process.env.BOB_BASE_URL}`);
  console.log(`Model     : ${process.env.BOB_MODEL}`);
  if (process.env.BOB_TEAM_ID) console.log(`Team ID   : ${process.env.BOB_TEAM_ID}`);
  if (process.env.BOB_INSTANCE_ID) console.log(`Instance  : ${process.env.BOB_INSTANCE_ID}`);
  console.log();

  const provider = new BobProvider();

  try {
    const result = await provider.complete({
      messages: [{ role: "user", content: "Reply with exactly: SMOKE_OK" }],
      temperature: 0,
    });

    console.log(`✅  Latency: ${result.latencyMs} ms`);
    console.log(`   Output : ${result.text.slice(0, 200)}`);
  } catch (err) {
    console.error("❌  Request failed:", err);
    process.exit(1);
  }
}

main();
