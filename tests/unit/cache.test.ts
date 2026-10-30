import { beforeAll, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Give the db singleton a temporary file before anything calls getDb().
beforeAll(() => {
  process.env.DATABASE_URL = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "medihacker-cache-")), "test.db");
});

import { cachedComplete, hashKey } from "@/lib/llm/cache";
import { MockProvider, setProvider } from "@/lib/llm/provider";
import type { CompleteOptions } from "@/lib/llm/provider";

const opts: CompleteOptions = {
  messages: [
    { role: "system", content: "sys" },
    { role: "user", content: "hi" },
  ],
  tag: "test",
};

describe("hashKey", () => {
  it("is deterministic for the same inputs", () => {
    expect(hashKey(["a", 1])).toBe(hashKey(["a", 1]));
  });
  it("changes when any input changes", () => {
    expect(hashKey(["a", 1])).not.toBe(hashKey(["a", 2]));
    expect(hashKey(["a"])).not.toBe(hashKey(["a", 1]));
  });
  it("produces a sha256 hex digest", () => {
    expect(hashKey(["x"])).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("cachedComplete", () => {
  it("calls the provider once and serves the second call from cache", async () => {
    const complete = vi.fn().mockResolvedValue("first answer");
    setProvider(new MockProvider(complete));

    const r1 = await cachedComplete(opts);
    expect(r1).toEqual({ text: "first answer", cached: false });
    const r2 = await cachedComplete(opts);
    expect(r2).toEqual({ text: "first answer", cached: true });
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("uses a different cache key for different options", async () => {
    const complete = vi.fn().mockResolvedValue("other");
    setProvider(new MockProvider(complete));

    await cachedComplete({ ...opts, json: true });
    await cachedComplete({ ...opts, fast: true });
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it("LLM_CACHE=off bypasses the read but still writes", async () => {
    const complete = vi.fn().mockResolvedValue("fresh");
    setProvider(new MockProvider(complete));
    // tag is not part of the cache key; use different messages for a fresh key.
    const fresh: CompleteOptions = { messages: [{ role: "user", content: "off-test prompt" }], tag: "off-test" };

    const r1 = await cachedComplete(fresh);
    expect(r1.cached).toBe(false);

    process.env.LLM_CACHE = "off";
    try {
      const r2 = await cachedComplete(fresh);
      expect(r2).toEqual({ text: "fresh", cached: false });
      expect(complete).toHaveBeenCalledTimes(2);
    } finally {
      delete process.env.LLM_CACHE;
    }

    // With the cache back on, the value written during the off run is served.
    const r3 = await cachedComplete(fresh);
    expect(r3).toEqual({ text: "fresh", cached: true });
    expect(complete).toHaveBeenCalledTimes(2);
  });
});
