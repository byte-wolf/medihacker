import fs from "node:fs";
import path from "node:path";

// Vitest does not load .env.local the way Next.js does. For live tests we fill
// in missing variables from .env.local so a configured OpenRouter key "just
// works" — explicitly set environment variables always win.
export function loadEnvLocal(): void {
  const file = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || m[1] in process.env) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
