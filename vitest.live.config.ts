import path from "node:path";
import { defineConfig } from "vitest/config";

// Live tests talk to the real configured LLM (OpenRouter, or a local
// OpenAI-compatible endpoint such as Ollama). They run only via
// `bun run test:live` — never in the default suite, so `bun run test`
// stays free and deterministic.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname), "server-only": path.resolve(__dirname, "tests/helpers/empty.ts") },
  },
  test: {
    include: ["tests/live/**/*.test.ts"],
    environment: "node",
    pool: "forks",
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
