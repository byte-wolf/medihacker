import { describe, expect, it } from "vitest";
import { compactPlan, deterministicPlan, MAX_BRIEFING_ITEMS, profileForRole, restrictPlan } from "@/lib/catalog/roles";

describe("deterministicPlan", () => {
  it("puts situation needs first and lists each category once", () => {
    const plan = deterministicPlan(["Emergency physician"], "She needs a CT with contrast at night");
    const keys = plan.flatMap((s) => s.items.map((i) => i.key));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.slice(0, 3)).toContain("contrast_safety");
  });

  it("combines two roles", () => {
    const keys = deterministicPlan(["Ward nurse", "Oncologist"], "").flatMap((s) => s.items.map((i) => i.key));
    expect(keys).toContain("tumour_histology");
    expect(keys).toContain("mobility_cognition");
  });

  it("falls back to a default profile for unknown roles", () => {
    expect(profileForRole("Physiotherapist").length).toBeGreaterThan(0);
  });
});

describe("role situations", async () => {
  const { ROLE_SITUATIONS, ROLE_QUESTIONS } = await import("@/lib/catalog/situations");
  const { SEED_USERS } = await import("@/lib/db/seed");
  it("gives every demo role three situations with suggested questions", () => {
    for (const u of SEED_USERS) {
      expect(ROLE_SITUATIONS[u.role], u.role).toHaveLength(3);
      for (const s of ROLE_SITUATIONS[u.role]) expect(s.questions.length).toBeGreaterThanOrEqual(2);
      expect(ROLE_QUESTIONS[u.role]?.length, u.role).toBeGreaterThan(0);
    }
  });
});

describe("role relevance", () => {
  it("does not show tumour biology to the anaesthetist before breast surgery", () => {
    const keys = deterministicPlan(
      ["Anaesthetist"],
      "Pre-operative anaesthesia check. Quadrantectomy (partial removal of the breast) with intraoperative radiotherapy; tumour board recommended it.",
    ).flatMap((s) => s.items.map((i) => i.key));
    expect(keys).not.toContain("tumour_receptors");
    expect(keys).not.toContain("tumour_histology");
    expect(keys).toContain("antithrombotics");
  });

  it("shows tumour biology to the surgeon", () => {
    const keys = deterministicPlan(["Breast surgeon"], "Surgery planning after the tumour board").flatMap((s) => s.items.map((i) => i.key));
    expect(keys).toContain("tumour_receptors");
  });
});

describe("compactPlan", () => {
  const keysOf = (plan: ReturnType<typeof compactPlan>) => plan.flatMap((s) => s.items.map((i) => i.key));

  it("caps the screen and always includes allergies", () => {
    const keys = keysOf(compactPlan(["Anaesthetist"], "Pre-operative anaesthesia check before surgery"));
    expect(keys.length).toBeLessThanOrEqual(MAX_BRIEFING_ITEMS);
    expect(keys).toContain("allergies");
    expect(keys).toContain("renal_function");
  });

  it("puts the situation's needs before the role's base needs", () => {
    const keys = keysOf(compactPlan(["General practitioner"], "Medication review at the GP after the hospital stay"));
    expect(keys).toEqual(expect.arrayContaining(["current_medication", "medication_changes", "allergies", "renal_function", "diabetes_control"]));
    expect(keys).not.toContain("followups_done");
  });

  it("lets a specific situation win over the broad pre-op checklist", () => {
    const keys = keysOf(compactPlan(["Anaesthetist"], "Glucose management on the day of surgery while she fasts"));
    expect(keys).toEqual(expect.arrayContaining(["glucose_lowering", "diabetes_control", "renal_function", "allergies"]));
  });

  it("still respects role exclusions", () => {
    expect(keysOf(compactPlan(["Breast surgeon"], "Explaining the biopsy result"))).toContain("tumour_receptors");
    expect(keysOf(compactPlan(["Anaesthetist"], "Breast cancer operation, pre-op check"))).not.toContain("tumour_receptors");
  });
});

describe("restrictPlan", () => {
  it("keeps plan order and puts unknown-to-plan keys in a last section", () => {
    const plan = restrictPlan(deterministicPlan(["Anaesthetist"], ""), ["renal_function", "allergies", "bone_health"]);
    expect(plan.flatMap((s) => s.items.map((i) => i.key))).toEqual(["allergies", "renal_function", "bone_health"]);
    expect(plan.at(-1)?.id).toBe("more");
  });
});
