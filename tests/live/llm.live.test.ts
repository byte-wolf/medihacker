import { beforeAll, describe, expect, it } from "vitest";
import { loadEnvLocal } from "../helpers/env";
import { setupSyntheticPatient } from "../helpers/synthetic";
import type { PatientRecord } from "@/lib/data/patients";

// Live tests use the real provider from the environment. They only run with
// LLM_LIVE=1 (see `bun run test:live`). For a free local model configure
// LLM_PROVIDER=openai-compatible + LLM_BASE_URL (e.g. Ollama) in .env.local.

loadEnvLocal();
const LIVE = process.env.LLM_LIVE === "1";

let provider: typeof import("@/lib/llm/provider");
let patient: PatientRecord;

beforeAll(async () => {
  setupSyntheticPatient();
  provider = await import("@/lib/llm/provider");
  patient = (await import("@/lib/data/patients")).getPatient("9999-0001")!;
});

describe.skipIf(!LIVE)("live LLM provider", () => {
  it("answers a trivial prompt", async () => {
    const res = await provider.getProvider().complete({
      messages: [{ role: "user", content: 'Reply with exactly the JSON object {"ok":true} and nothing else.' }],
      json: true,
      maxTokens: 50,
      tag: "live-smoke",
    });
    expect(res.text.trim().length).toBeGreaterThan(0);
    expect(res.model.length).toBeGreaterThan(0);
    expect(provider.parseJsonObject(res.text)).toBeTruthy();
  });
});

describe.skipIf(!LIVE)("live briefing pipeline", () => {
  it("produces sections whose facts all carry real source quotes", async () => {
    const { buildBriefing } = await import("@/lib/briefing/pipeline");
    const result = await buildBriefing(patient, ["Anaesthetist"], null, () => {});
    expect(result.sections.length).toBeGreaterThan(0);
    const passageIds = new Set(patient.passages.map((p) => p.id));
    const items = result.sections.flatMap((s) => s.items);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(["documented", "not_documented", "unverified"]).toContain(item.status);
      for (const fact of item.facts) {
        expect(fact.quotes.length).toBeGreaterThan(0);
        for (const q of fact.quotes) expect(passageIds.has(q.passageId)).toBe(true);
      }
    }
  });

  it("answers a free-text question with cited passages", async () => {
    const { answerQuestion } = await import("@/lib/chat/answer");
    const r = await answerQuestion({ patient, roles: ["Anaesthetist"], situation: null, history: [], question: "Is the patient anticoagulated?" });
    const facts = r.items.flatMap((i) => i.facts);
    expect(facts.length).toBeGreaterThan(0);
    const passageIds = new Set(patient.passages.map((p) => p.id));
    for (const f of facts) for (const q of f.quotes) expect(passageIds.has(q.passageId)).toBe(true);
  });
});
