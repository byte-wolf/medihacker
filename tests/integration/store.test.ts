import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { setupSyntheticPatient } from "../helpers/synthetic";
import type { CompleteOptions } from "@/lib/llm/provider";
import type { PatientRecord } from "@/lib/data/patients";

// Contradiction store + translations end to end on the synthetic patient,
// with a scripted provider so no real model is needed.

let store: typeof import("@/lib/contradictions/store");
let translations: typeof import("@/lib/data/translations");
let provider: typeof import("@/lib/llm/provider");
let patients: typeof import("@/lib/data/patients");
let rules: typeof import("@/lib/contradictions/rules");
let db: ReturnType<typeof import("@/lib/db").getDb>;
let schema: typeof import("@/lib/db/schema");
let patient: PatientRecord;

function passageId(text: string) {
  const p = patient.passages.find((x) => x.text.includes(text));
  if (!p) throw new Error(`no passage with ${text}`);
  return p.id;
}

function scripted(opts: CompleteOptions): string {
  if (opts.tag === "contradictions") {
    return JSON.stringify({
      contradictions: [
        {
          title: "Kidney function vs metformin",
          explanation: "Renal insufficiency stage III documented but metformin continued.",
          severity: "high",
          passageIds: [passageId("Niereninsuffizienz"), passageId("Metformin")],
        },
        // One valid + one bogus passage id: whole candidate must be dropped.
        { title: "Bogus", explanation: "x", passageIds: [passageId("Gewicht: 80"), "9999:nope"] },
        // Single passage only: dropped.
        { title: "Single", explanation: "x", passageIds: [passageId("Gewicht: 80")] },
        // Overlaps a rule finding (the carotid laterality finding uses these).
        {
          title: "Duplicate of rule",
          explanation: "x",
          passageIds: [passageId("carotis interna links"), passageId("carotis interna rechts")],
        },
      ],
    });
  }
  if (opts.tag === "skeptic") {
    return JSON.stringify({
      verdicts: [
        { index: 0, keep: true },
        { index: 1, keep: false },
      ],
    });
  }
  if (opts.tag === "translate") {
    const ids = [...(opts.messages.at(-1)?.content ?? "").matchAll(/\b(\d+:p\d+)\b/g)].map((m) => m[1]);
    return JSON.stringify({ translations: Object.fromEntries(ids.map((id) => [id, `EN ${id}`])) });
  }
  return JSON.stringify({});
}

beforeAll(async () => {
  setupSyntheticPatient();
  [store, translations, provider, patients, rules, schema] = await Promise.all([
    import("@/lib/contradictions/store"),
    import("@/lib/data/translations"),
    import("@/lib/llm/provider"),
    import("@/lib/data/patients"),
    import("@/lib/contradictions/rules"),
    import("@/lib/db/schema"),
  ]);
  db = (await import("@/lib/db")).getDb();
  patient = patients.getPatient("9999-0001")!;
});

afterAll(() => provider.setProvider(null));

describe("ensureContradictions", () => {
  it("persists rule-based contradictions on first run", () => {
    provider.setProvider(null);
    store.ensureContradictions(patient);
    const ruleRows = db.select().from(schema.contradictions).all().filter((c) => c.detectedBy === "rule");
    expect(ruleRows.length).toBe(rules.runContradictionRules(patient).length);
    expect(ruleRows.length).toBeGreaterThan(0);
  });

  it("records 'rules' mode in the patient index when no model is configured", () => {
    provider.setProvider(null);
    store.ensureContradictions(patient);
    const idx = db.select().from(schema.patientIndex).where(eq(schema.patientIndex.patientId, patient.id)).get();
    expect(idx?.contradictionMode).toBe("rules");
  });

  it("runs the LLM scan once in the background and keeps only verified candidates", async () => {
    provider.setProvider(new provider.MockProvider(scripted));
    // Force the llm pass: pretend the index is stale.
    db.delete(schema.patientIndex).run();
    store.ensureContradictions(patient);
    await store.awaitContradictionScan(patient.id);

    const idx = db.select().from(schema.patientIndex).where(eq(schema.patientIndex.patientId, patient.id)).get();
    expect(idx?.contradictionMode).toBe("rules+llm");

    const llmRows = db.select().from(schema.contradictions).all().filter((c) => c.detectedBy === "llm");
    expect(llmRows).toHaveLength(1);
    expect(llmRows[0].title).toBe("Kidney function vs metformin");
    expect(llmRows[0].severity).toBe("high");
    expect(llmRows[0].passageIds).toEqual([passageId("Niereninsuffizienz"), passageId("Metformin")]);
  });

  it("listContradictions returns findings ordered by severity", () => {
    const list = store.listContradictions(patient.id);
    const order = ["high", "medium", "low"];
    const ranks = list.map((c) => order.indexOf(c.severity));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(list.every((c) => c.id && c.title && c.explanation)).toBe(true);
  });
});

describe("ensureTranslations", () => {
  it("translates passages once and stores them per document", async () => {
    provider.setProvider(new provider.MockProvider(scripted));
    const docId = patient.documents[0].id;
    await translations.ensureTranslations(patient);
    const map = translations.translationsForDocument(patient, docId);
    expect(Object.keys(map).length).toBeGreaterThan(0);
    for (const [id, t] of Object.entries(map)) {
      expect(id).toMatch(new RegExp(`^${docId}:p`));
      expect(t).toBe(`EN ${id}`);
    }
  });

  it("does not call the model again when everything is translated", async () => {
    const calls: string[] = [];
    provider.setProvider(
      new provider.MockProvider((opts) => {
        calls.push(opts.tag ?? "?");
        return scripted(opts);
      }),
    );
    await translations.ensureTranslations(patient);
    expect(calls).toHaveLength(0);
  });

  it("returns an empty map for a document without translations", () => {
    const fake = { ...patient, id: "other", passages: [], hash: "x" } as unknown as PatientRecord;
    expect(translations.translationsForDocument(fake, "900001")).toEqual({});
  });
});
