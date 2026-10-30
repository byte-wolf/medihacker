import { describe, expect, it } from "vitest";
import { bmiOf, prefillAnesthesia, saveBlockers, suggestAsa, type Checklist } from "@/lib/documents/anesthesia";
import type { StructuredData, StructuredNode } from "@/lib/data/structured";

// Pure checklist logic: pre-fill from structured data, BMI, ASA rules, save rules. No LLM, no DB.

const mention = (text: string, date: string, docId: string): StructuredNode => ({ name: text, text, date: { value: date }, documentIds: [docId] });
const finding = (name: string, status: string, ...m: StructuredNode[]): StructuredNode => ({ id: name, name, status, values: m });
const group = (name: string, ...findings: StructuredNode[]): StructuredNode => ({ id: name, name, values: findings });

const structured: StructuredData = {
  adverseReactions: ["Arzneimittel-Allergie"],
  medication: [
    {
      name: "HERZ-KREISLAUF",
      values: [
        {
          name: "ACE-Hemmer",
          values: [
            {
              id: "ramipril",
              name: "Ramipril",
              values: [mention("Ramipril 2,5mg 1 0 0 0", "2023-01-xx", "d1"), mention("Ramipril 5mg   oral   1   0   0   0   ST", "2024-03-xx", "d2")],
            },
          ],
        },
      ],
    },
  ],
  diagnoses: [
    {
      name: "HERZ-KREISLAUF",
      values: [
        group("Essentielle (primäre) Hypertonie", finding("Art. Hypertonie", "positive", mention("art HT", "2024-03-xx", "d2"))),
        group("Vorhofflimmern", finding("VHF?", "suspected", mention("VHF?", "2024-03-xx", "d2"))),
        group("Perikarderguss", finding("Kein Perikarderguss", "negative", mention("Kein Perikarderguss", "2024-03-xx", "d2"))),
        group("Retinopathie", finding("Fundus hypertonicus", "positive", mention("Fundus hypertonicus bds.", "2024-03-xx", "d2"))),
      ],
    },
  ],
  procedures: [
    { name: "DIAGNOSTIK", values: [group("Herz", finding("EKG", "positive", mention("EKG", "2024-03-xx", "d2")))] },
    {
      name: "OPERATIONEN",
      values: [
        group(
          "Galle",
          finding("St.p. CHE", "statuspost", mention("St.p. CHE", "2015-06-xx", "d1")),
          finding("Hernienplastik geplant", "recommended", mention("Hernienplastik", "2024-03-xx", "d2")),
        ),
      ],
    },
  ],
  scores: [
    { name: "Größe", unit: "m", values: [{ value: "1,72", date: { value: "2024-03-xx" }, documentIds: ["d2"] }] },
    { name: "Gewicht", unit: "kg", values: [{ value: "86", date: { value: "2024-03-xx" }, documentIds: ["d2"] }] },
    { name: "HbA1c", unit: "%", values: [{ value: "6,4", date: { value: "2024-03-xx" }, documentIds: ["d2"] }] },
  ],
};

const patient = { id: "X-1", name: "Test Person", dateOfBirth: "1950-01-01", sex: "male" };

function base(allergyPassages = [{ passageId: "d2:p004", text: "KM-Allergie (Übelkeit)" }]): Checklist {
  return prefillAnesthesia({ patient, structured, allergyPassages, referenceDate: "2024-03-20" });
}

function filled(overrides: Partial<Checklist["exam"]> = {}, c = base()): Checklist {
  return { ...c, exam: { ...c.exam, bpSystolic: "130", bpDiastolic: "80", smoking: "never", alcohol: "none", ...overrides } };
}

describe("prefillAnesthesia", () => {
  it("fills identity unconfirmed and allergies from the documents, unconfirmed", () => {
    const c = base();
    expect(c.identity).toMatchObject({ patientId: "X-1", name: "Test Person", confirmed: false });
    expect(c.allergies.confirmed).toBe(false);
    expect(c.allergies.entries).toEqual([{ id: "d2:p004", origin: "record", text: "KM-Allergie (Übelkeit)", date: "", docIds: ["d2"] }]);
  });

  it("falls back to the CAVE extract when the documents name no allergy", () => {
    expect(base([]).allergies.entries.map((e) => e.text)).toEqual(["Arzneimittel-Allergie"]);
  });

  it("takes the newest mention per drug, whitespace cleaned", () => {
    expect(base().medication).toEqual([
      { id: "ramipril", origin: "record", drug: "Ramipril", dosage: "Ramipril 5mg oral 1 0 0 0 ST", date: "2024-03-xx", docIds: ["d1", "d2"] },
    ]);
  });

  it("lists conditions per ICD group, keeps suspected ones marked, drops negatives", () => {
    const c = base();
    expect(c.conditions.map((x) => [x.label, x.status])).toEqual([
      ["Essentielle (primäre) Hypertonie", "positive"],
      ["Vorhofflimmern", "suspected"],
      ["Retinopathie", "positive"],
    ]);
  });

  it("lists previous surgery only, not planned operations or diagnostics", () => {
    expect(base().surgeries.map((s) => s.label)).toEqual(["St.p. CHE"]);
  });

  it("pre-fills only height (m → cm) and weight in the examination", () => {
    const e = base().exam;
    expect(e.heightCm).toBe("172");
    expect(e.weightKg).toBe("86");
    expect([e.bpSystolic, e.bpDiastolic, e.temperature, e.mallampati, e.smoking, e.alcohol]).toEqual(["", "", "", "", "", ""]);
    expect(e.dental).toEqual([]);
  });
});

describe("bmiOf", () => {
  it("calculates BMI with one decimal and accepts decimal commas", () => {
    expect(bmiOf("172", "86")).toBe(29.1);
    expect(bmiOf("170", "66,5")).toBe(23);
  });
  it("returns null for missing or implausible values", () => {
    expect(bmiOf("", "80")).toBeNull();
    expect(bmiOf("1.72", "80")).toBeNull(); // metres, not cm
  });
});

describe("suggestAsa", () => {
  it("stays incomplete until the required fields are filled", () => {
    const r = suggestAsa(base());
    expect(r).toEqual({ status: "incomplete", missing: ["Blood pressure", "Smoking history", "Alcohol history"] });
  });

  it("controlled hypertension gives ASA II; eye findings and suspected diagnoses are not counted", () => {
    const r = suggestAsa(filled());
    expect(r.status).toBe("complete");
    if (r.status !== "complete") return;
    expect(r.asaClass).toBe("II");
    expect(r.reasons.map((x) => x.text)).toEqual(["Hypertension: Essentielle (primäre) Hypertonie"]);
  });

  it("a healthy patient without risk factors is ASA I", () => {
    const c = filled();
    expect(suggestAsa({ ...c, conditions: [] })).toMatchObject({ status: "complete", asaClass: "I" });
  });

  it("poorly controlled blood pressure raises hypertension to ASA III", () => {
    expect(suggestAsa(filled({ bpSystolic: "185", bpDiastolic: "95" }))).toMatchObject({ asaClass: "III" });
  });

  it("smoking, alcohol and BMI follow the ASA examples", () => {
    const none = { ...filled(), conditions: [] };
    expect(suggestAsa({ ...none, exam: { ...none.exam, smoking: "current" } })).toMatchObject({ asaClass: "II" });
    expect(suggestAsa({ ...none, exam: { ...none.exam, alcohol: "dependence" } })).toMatchObject({ asaClass: "III" });
    expect(suggestAsa({ ...none, exam: { ...none.exam, weightKg: "125" } })).toMatchObject({ asaClass: "III" }); // BMI 42.3
  });

  it("TIA within 3 months is ASA IV, older is ASA III", () => {
    const tia = (date: string): Checklist => ({
      ...filled(),
      conditions: [{ id: "t", origin: "manual", label: "Amaurosis fugax", detail: "", status: "positive", date, docIds: [] }],
    });
    expect(suggestAsa(tia("2024-02-xx"))).toMatchObject({ asaClass: "IV" });
    expect(suggestAsa(tia("2015-06-xx"))).toMatchObject({ asaClass: "III" });
  });

  it("uses the documented ejection fraction", () => {
    const c = filled();
    expect(suggestAsa({ ...c, record: { ...c.record, ejectionFraction: { value: 35, date: "2024-03-xx", docIds: [] } } })).toMatchObject({ asaClass: "III" });
    expect(suggestAsa({ ...c, record: { ...c.record, ejectionFraction: { value: 20, date: "2024-03-xx", docIds: [] } } })).toMatchObject({ asaClass: "IV" });
  });
});

describe("saveBlockers", () => {
  it("requires identity, allergies, ASA fields and a confirmed ASA class", () => {
    expect(saveBlockers(base())).toHaveLength(4);
    const ok = filled();
    const done: Checklist = {
      ...ok,
      identity: { ...ok.identity, confirmed: true },
      allergies: { ...ok.allergies, confirmed: true },
      asa: { ...ok.asa, finalClass: "II" },
    };
    expect(saveBlockers(done)).toEqual([]);
  });
});
