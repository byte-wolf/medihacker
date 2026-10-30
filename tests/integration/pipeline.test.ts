import { beforeAll, describe, expect, it } from "vitest";
import { setupSyntheticPatient } from "../helpers/synthetic";
import type { CompleteOptions } from "@/lib/llm/provider";
import type { BriefingStreamEvent } from "@/lib/types";

// The pipeline end to end with a scripted model: one correct fact, one
// invented fact, one "not documented" answer and one item the model skipped.

let mods: {
  pipeline: typeof import("@/lib/briefing/pipeline");
  provider: typeof import("@/lib/llm/provider");
  patients: typeof import("@/lib/data/patients");
  chat: typeof import("@/lib/chat/answer");
};

function passageId(text: string) {
  const p = mods.patients.getPatient("9999-0001")!.passages.find((x) => x.text.includes(text));
  if (!p) throw new Error(`no passage with ${text}`);
  return p.id;
}

function scripted(opts: CompleteOptions): string {
  const prompt = opts.messages.map((m) => m.content).join("\n");
  if (opts.tag === "chat") {
    return JSON.stringify({
      items: [
        {
          key: "answer_1",
          label: "Anticoagulation",
          status: "documented",
          facts: [{ statement: "Apixaban (Eliquis) 5 mg 1-0-1", quotes: [{ passageId: passageId("Eliquis 5mg oral"), text: "Eliquis 5mg oral 1 0 1 0" }] }],
        },
      ],
    });
  }
  if (!opts.tag?.startsWith("extract:")) return JSON.stringify({ items: [] });
  const keys = [...prompt.matchAll(/- key "([a-z_]+)"/g)].map((m) => m[1]);
  const items = keys.map((key) => {
    if (key === "antithrombotics")
      return {
        key,
        status: "documented",
        facts: [
          { statement: "Apixaban (Eliquis) 5 mg 1-0-1", quotes: [{ passageId: passageId("Eliquis 5mg oral"), text: "Eliquis 5mg oral 1 0 1 0 ST" }] },
          // Invented: no such drug or dose in the documents
          { statement: "Clopidogrel 75 mg 1-0-0", quotes: [{ passageId: passageId("Eliquis 5mg oral"), text: "Clopidogrel 75mg" }] },
        ],
      };
    if (key === "allergies")
      return {
        key,
        status: "documented",
        facts: [{ statement: "Penicillin allergy (rash)", quotes: [{ passageId: passageId("Penicillin-Allergie"), text: "Penicillin-Allergie (Exanthem)" }] }],
      };
    if (key === "contrast_safety") return { key, status: "not_documented", note: "No contrast reaction documented." };
    return null; // skipped by the model
  });
  return JSON.stringify({ items: items.filter(Boolean) });
}

beforeAll(async () => {
  setupSyntheticPatient();
  mods = {
    pipeline: await import("@/lib/briefing/pipeline"),
    provider: await import("@/lib/llm/provider"),
    patients: await import("@/lib/data/patients"),
    chat: await import("@/lib/chat/answer"),
  };
  mods.provider.setProvider(new mods.provider.MockProvider(scripted));
});

describe("briefing pipeline", () => {
  it("streams plan, verified sections, contradictions and done", async () => {
    const patient = mods.patients.getPatient("9999-0001")!;
    const events: BriefingStreamEvent[] = [];
    const result = await mods.pipeline.buildBriefing(
      patient,
      ["Emergency physician"],
      { title: "Night shift", description: "She arrives with dizziness and needs a CT with contrast." },
      (e) => events.push(e),
    );
    const types = events.map((e) => e.type);
    expect(types[0]).toBe("plan");
    expect(types.at(-1)).toBe("done");
    expect(types).toContain("contradictions");

    const items = result.sections.flatMap((s) => s.items);
    const anti = items.find((i) => i.key === "antithrombotics")!;
    expect(anti.status).toBe("documented");
    expect(anti.facts.map((f) => f.statement)).toEqual(["Apixaban (Eliquis) 5 mg 1-0-1"]);

    const debug = events.filter((e): e is Extract<BriefingStreamEvent, { type: "debug" }> => e.type === "debug").flatMap((e) => e.rejected);
    expect(debug.some((r) => r.statement.startsWith("Clopidogrel"))).toBe(true);

    expect(items.find((i) => i.key === "contrast_safety")?.status).toBe("not_documented");
    expect(items.find((i) => i.key === "prior_events")?.status).toBe("unverified");

    // Minimal screen: at most 8 items, allergies always among them
    expect(items.length).toBeLessThanOrEqual(8);
    expect(items.some((i) => i.key === "allergies")).toBe(true);

    const tokens = events.find((e): e is Extract<BriefingStreamEvent, { type: "tokens" }> => e.type === "tokens");
    expect(tokens?.calls.some((c) => c.tag.startsWith("extract:"))).toBe(true);
  });

  it("marks facts that touch a contradiction", async () => {
    const patient = mods.patients.getPatient("9999-0001")!;
    const events: BriefingStreamEvent[] = [];
    await mods.pipeline.buildBriefing(patient, ["Anaesthetist"], null, (e) => events.push(e));
    const last = events.filter((e) => e.type === "contradictions").at(-1) as Extract<BriefingStreamEvent, { type: "contradictions" }>;
    expect(last.all.length).toBeGreaterThanOrEqual(3);
    expect(last.relevant.length).toBeGreaterThan(0);
  });
});

describe("item selection by the model", () => {
  it("shows only the items the model picked, plus allergies", async () => {
    const select = (opts: CompleteOptions) =>
      opts.tag === "select" ? JSON.stringify({ keys: ["antithrombotics", "contrast_safety", "renal_function"], custom: [] }) : scripted(opts);
    mods.provider.setProvider(new mods.provider.MockProvider(select));
    const patient = mods.patients.getPatient("9999-0001")!;
    const result = await mods.pipeline.buildBriefing(patient, ["Emergency physician"], { title: "Selection test", description: "CT with contrast tonight." }, () => {});
    const keys = result.sections.flatMap((s) => s.items.map((i) => i.key)).sort();
    expect(keys).toEqual(["allergies", "antithrombotics", "contrast_safety", "renal_function"]);
    mods.provider.setProvider(new mods.provider.MockProvider(scripted));
  });

  it("LLM_ITEMS_PER_CALL packs more items into each extraction call", async () => {
    const select = (opts: CompleteOptions) =>
      opts.tag === "select" ? JSON.stringify({ keys: ["antithrombotics", "contrast_safety", "renal_function", "current_medication"], custom: [] }) : scripted(opts);
    mods.provider.setProvider(new mods.provider.MockProvider(select));
    const patient = mods.patients.getPatient("9999-0001")!;
    const situation = { title: "Batch test", description: "CT with contrast, batch of items." };
    const extractCalls = async (per: string) => {
      process.env.LLM_ITEMS_PER_CALL = per;
      const events: BriefingStreamEvent[] = [];
      const result = await mods.pipeline.buildBriefing(patient, ["Emergency physician"], situation, (e) => events.push(e));
      const tokens = events.find((e): e is Extract<BriefingStreamEvent, { type: "tokens" }> => e.type === "tokens")!;
      return { calls: tokens.calls.filter((c) => c.tag.startsWith("extract:")).length, items: result.sections.flatMap((s) => s.items).length };
    };
    const one = await extractCalls("1");
    const eight = await extractCalls("8");
    delete process.env.LLM_ITEMS_PER_CALL;
    expect(one.calls).toBe(5);
    expect(eight.calls).toBe(1);
    expect(eight.items).toBe(one.items);
    mods.provider.setProvider(new mods.provider.MockProvider(scripted));
  });
});

describe("chat", () => {
  it("answers with verified, cited facts", async () => {
    const patient = mods.patients.getPatient("9999-0001")!;
    const r = await mods.chat.answerQuestion({ patient, roles: ["Anaesthetist"], situation: null, history: [], question: "Is she anticoagulated?" });
    expect(r.items[0].facts[0].quotes[0].passageId).toMatch(/^900001:/);
  });
});

describe("retrieval fallback without a model", () => {
  it("shows matching source passages instead of failing", async () => {
    mods.provider.setProvider(new mods.provider.MockProvider());
    const patient = mods.patients.getPatient("9999-0001")!;
    const result = await mods.pipeline.buildBriefing(patient, ["Clinical pharmacist"], null, () => {});
    expect(result.fallback).toBe(true);
    const meds = result.sections.flatMap((s) => s.items).find((i) => i.key === "current_medication")!;
    expect(meds.facts.length).toBeGreaterThan(0);
    mods.provider.setProvider(new mods.provider.MockProvider(scripted));
  });
});
