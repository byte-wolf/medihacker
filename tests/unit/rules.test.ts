import { beforeAll, describe, expect, it } from "vitest";
import { setupSyntheticPatient } from "../helpers/synthetic";
import type { PatientRecord } from "@/lib/data/patients";

let patient: PatientRecord;
let rules: typeof import("@/lib/contradictions/rules");

beforeAll(async () => {
  setupSyntheticPatient();
  const { getPatient } = await import("@/lib/data/patients");
  rules = await import("@/lib/contradictions/rules");
  patient = getPatient("9999-0001")!;
});

describe("contradiction rules", () => {
  it("flags a BMI that does not match height and weight in the same document", () => {
    const found = rules.checkBmi(patient);
    expect(found).toHaveLength(1);
    expect(found[0].passageIds.every((id) => id.startsWith("900001:"))).toBe(true);
  });

  it("does not flag a weight change between documents (change over time)", () => {
    const all = rules.runContradictionRules(patient);
    expect(all.some((c) => /weight/i.test(c.title) && c.passageIds.some((id) => id.startsWith("900002")))).toBe(false);
  });

  it("flags two different admission dates in one letter, ignoring the birth date", () => {
    const found = rules.checkEventDates(patient);
    const admission = found.find((c) => c.categories.includes("admission"));
    expect(admission).toBeDefined();
    expect(admission!.explanation).toContain("12.03.2020");
    expect(admission!.explanation).not.toContain("1950");
  });

  it("does not flag consistent discharge dates", () => {
    expect(rules.checkEventDates(patient).some((c) => c.categories.includes("discharge"))).toBe(false);
  });

  it("flags a finding reported on both sides and links all passages", () => {
    const found = rules.checkLaterality(patient);
    expect(found).toHaveLength(1);
    expect(found[0].passageIds.length).toBeGreaterThanOrEqual(3);
  });

  it("gives stable ids", () => {
    expect(rules.runContradictionRules(patient).map((c) => c.id)).toEqual(rules.runContradictionRules(patient).map((c) => c.id));
  });
});

describe("weight trend by rule", () => {
  it("shows every weighing with its date in one trend line with the calculated change", async () => {
    const { weightTrendItem } = await import("@/lib/briefing/items");
    const item = weightTrendItem(patient)!;
    expect(item.facts.map((f) => f.statement)).toEqual(["Weight 80 kg (20 Mar 2020) → 72 kg (1 Sep 2020); change −8 kg."]);
    expect(item.facts[0].kind).toBe("calculated");
  });
});
