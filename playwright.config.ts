import { defineConfig, devices } from "@playwright/test";

// E2E runs against a production build on port 3100 with its own database and
// without an LLM (keyword-retrieval mode), so it is deterministic and free.
// Set E2E_BASE_URL to run against an already running server (faster iteration).
const PORT = 3100;
const external = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: external ?? `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: external
    ? undefined
    : {
    command: `next build && next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: "./test-results/e2e.db",
      LLM_PROVIDER: "mock",
      SESSION_SECRET: "e2e-secret",
    },
  },
});
