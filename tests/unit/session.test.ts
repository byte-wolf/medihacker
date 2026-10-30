import { afterEach, describe, expect, it, vi } from "vitest";

// Route-level cookie jar shared with tests/integration/auth-routes.test.ts conventions.
const jar = vi.hoisted(() => ({ store: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.store.has(name) ? { name, value: jar.store.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.store.set(name, value),
    delete: (name: string) => void jar.store.delete(name),
  }),
}));

import { parseSessionValue, sessionValue } from "@/lib/auth/session";

describe("sessionValue / parseSessionValue", () => {
  const SECRET = process.env.SESSION_SECRET;
  afterEach(() => {
    if (SECRET === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = SECRET;
  });

  it("round-trips a user id", () => {
    expect(parseSessionValue(sessionValue(1))).toBe(1);
    expect(parseSessionValue(sessionValue(42))).toBe(42);
  });

  it("produces 'id.signature' with a 32-char hex signature", () => {
    const [id, sig] = sessionValue(7).split(".");
    expect(id).toBe("7");
    expect(sig).toMatch(/^[0-9a-f]{32}$/);
  });

  it("rejects a tampered user id", () => {
    const forged = sessionValue(1).replace(/^1\./, "2.");
    expect(parseSessionValue(forged)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const v = sessionValue(3);
    expect(parseSessionValue(v.slice(0, -1) + (v.endsWith("0") ? "1" : "0"))).toBeNull();
  });

  it("rejects garbage input", () => {
    expect(parseSessionValue(undefined)).toBeNull();
    expect(parseSessionValue("")).toBeNull();
    expect(parseSessionValue("abc")).toBeNull();
    expect(parseSessionValue("1.")).toBeNull();
    expect(parseSessionValue(".deadbeef")).toBeNull();
  });

  it("signs differently under a different SESSION_SECRET", () => {
    process.env.SESSION_SECRET = "secret-a";
    const a = sessionValue(5);
    process.env.SESSION_SECRET = "secret-b";
    const b = sessionValue(5);
    expect(a).not.toBe(b);
    // A cookie minted under secret-a no longer verifies under secret-b.
    expect(parseSessionValue(a)).toBeNull();
  });
});
