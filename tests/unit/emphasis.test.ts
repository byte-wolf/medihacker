import { describe, expect, it } from "vitest";
import { emphasisSpans, isNoAllergyStatement } from "@/lib/briefing/emphasis";

const bold = (t: string) => emphasisSpans(t).filter((s) => s.strong).map((s) => s.text);

describe("emphasisSpans", () => {
  it("bolds drug and dose, not the schedule", () => {
    expect(bold("Thrombo ASS 100mg oral 1 0 0 0 ST")).toEqual(["Thrombo ASS 100mg"]);
    expect(bold("Glucophage 1000 mg 1-0-1")).toEqual(["Glucophage 1000 mg"]);
    expect(bold("Takes Eliquis 5 mg twice daily")).toEqual(["Eliquis 5 mg"]);
  });

  it("bolds numbers with units and named values", () => {
    expect(bold("Weight 88 kg (15 Mar 2024).")).toEqual(["88 kg"]);
    expect(bold("RR: 152/88 mmHg")).toEqual(["RR: 152/88 mmHg"]);
    expect(bold("145/88 mmHg (5 Apr 2016)")).toEqual(["145/88 mmHg"]);
    expect(bold("The patient has obesity (BMI 29.1, Oct 2024).")).toEqual(["BMI 29.1"]);
    expect(bold("Weight 88 → 85 → 86 kg; change −2 kg.")).toEqual(["88 → 85 → 86 kg", "−2 kg"]);
  });

  it("bolds the allergen", () => {
    expect(bold("The patient has a documented allergy to iodinated contrast media, manifesting as an exanthem.")).toEqual([
      "iodinated contrast media",
    ]);
    expect(bold("Penicillin-Allergie (Exanthem)")).toEqual(["Penicillin-Allergie"]);
    expect(bold("Penicillin allergy (rash)")).toEqual(["Penicillin allergy"]);
  });

  it("bolds nothing when there is no clinical value", () => {
    expect(bold("The patient has obesity.")).toEqual([]);
    expect(bold("COPD GOLD II with recent acute exacerbation.")).toEqual([]);
    expect(bold("Herz nicht vergrößert.")).toEqual([]);
    expect(bold("Z.n. inferiorem Hinterwandinfarkt 2018")).toEqual([]);
  });

  it("keeps the full text in order", () => {
    const t = "Thrombo ASS 100mg oral, stop 7 days before surgery";
    expect(emphasisSpans(t).map((s) => s.text).join("")).toBe(t);
  });
});

describe("isNoAllergyStatement", () => {
  it("recognises 'no known allergies'", () => {
    expect(isNoAllergyStatement("No known drug allergies.")).toBe(true);
    expect(isNoAllergyStatement("Allergien: keine bekannt")).toBe(true);
    expect(isNoAllergyStatement("Penicillin-Allergie (Exanthem)")).toBe(false);
  });
});
