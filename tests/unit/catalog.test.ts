import { describe, expect, it } from "vitest";
import { deterministicPlan, profileForRole } from "@/lib/catalog/roles";

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
