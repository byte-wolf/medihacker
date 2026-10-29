import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Runtime code must find facts and contradictions itself: it may never read the
// evaluation reference files or the hackathon's expected answers.
function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? files(p) : /\.(ts|tsx)$/.test(d.name) ? [p] : [];
  });
}

describe("runtime code boundaries", () => {
  const runtime = ["app", "lib", "components"].flatMap((d) => files(path.resolve(d)));
  it("never imports evaluation references or expected answers", () => {
    for (const f of runtime) {
      const src = fs.readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/expected\.json|contradictions\.reference|from ["'](\.\.\/)*eval\//);
    }
  });
});
