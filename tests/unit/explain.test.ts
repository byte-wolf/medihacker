import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

beforeAll(() => {
  process.env.DATABASE_URL = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "medihacker-explain-")), "test.db");
  // The prompt is identical across tests; bypass the read-through cache so each
  // scripted provider response is actually used.
  process.env.LLM_CACHE = "off";
});

import { EXPLAIN_MAX_TOKENS, explainItem } from "@/lib/briefing/explain";
import { MockProvider, setProvider } from "@/lib/llm/provider";
import type { CompleteOptions } from "@/lib/llm/provider";

const args = {
  roles: ["Anaesthetist"],
  situation: { title: "Pre-op", description: "Planned cholecystectomy tomorrow." },
  label: "Antithrombotics",
};

function provider(returning: unknown, captured?: { opts?: CompleteOptions }) {
  setProvider(
    new MockProvider(async (opts) => {
      if (captured) captured.opts = opts;
      return typeof returning === "string" ? returning : JSON.stringify(returning);
    }),
  );
}

describe("explainItem", () => {
  it("returns the explanation and a whitelisted guideline link", async () => {
    provider({ why: "Anticoagulants change the anaesthesia plan.", guideline: { title: "AWMF Guideline", url: "https://www.awmf.org/leitlinien/001.html" } });
    const r = await explainItem(args);
    expect(r.why).toBe("Anticoagulants change the anaesthesia plan.");
    expect(r.guideline).toEqual({ title: "AWMF Guideline", url: "https://www.awmf.org/leitlinien/001.html" });
  });

  it("accepts subdomains of whitelisted publishers", async () => {
    provider({ why: "w", guideline: { title: "NICE", url: "https://pathways.nice.org.uk/x" } });
    const r = await explainItem(args);
    expect(r.guideline?.url).toBe("https://pathways.nice.org.uk/x");
  });

  it("turns links to other hosts into a guideline search", async () => {
    provider({ why: "w", guideline: { title: "Some paper", url: "https://spam.example.com/ad" } });
    const r = await explainItem(args);
    expect(r.guideline?.url).toBe(`https://www.google.com/search?q=${encodeURIComponent("Some paper guideline")}`);
  });

  it("turns invalid or non-https urls into a search as well", async () => {
    provider({ why: "w", guideline: { title: "x", url: "http://insecure.example.org" } });
    expect((await explainItem(args)).guideline?.url).toContain("google.com/search");

    provider({ why: "w", guideline: { title: "x", url: "not a url" } });
    expect((await explainItem(args)).guideline?.url).toContain("google.com/search");
  });

  it("drops guidelines without a usable title", async () => {
    provider({ why: "w", guideline: { url: "https://awmf.org/x" } });
    expect((await explainItem(args)).guideline).toBeNull();
    provider({ why: "w", guideline: { title: "  ", url: "https://awmf.org/x" } });
    expect((await explainItem(args)).guideline).toBeNull();
    provider({ why: "w" });
    expect((await explainItem(args)).guideline).toBeNull();
  });

  it("throws when the model returns no explanation", async () => {
    provider({ why: "   " });
    await expect(explainItem(args)).rejects.toThrow("Empty explanation");
    provider({});
    await expect(explainItem(args)).rejects.toThrow("Empty explanation");
  });

  it("uses the fast model with a small token cap", async () => {
    const captured: { opts?: CompleteOptions } = {};
    provider({ why: "ok" }, captured);
    await explainItem(args);
    expect(captured.opts).toMatchObject({ fast: true, json: true, tag: "explain", maxTokens: EXPLAIN_MAX_TOKENS });
    expect(captured.opts?.signal).toBeInstanceOf(AbortSignal);
  });
});
