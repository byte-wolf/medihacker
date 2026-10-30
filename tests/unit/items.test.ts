import { beforeAll, describe, expect, it } from "vitest";
import { setupSyntheticPatient } from "../helpers/synthetic";
import { demographicsItem, isAbsenceClaim, itemsFromModel, retrievalItems, verifyContext, weightTrendItem } from "@/lib/briefing/items";
import type { PatientRecord } from "@/lib/data/patients";
import type { PlannedItem } from "@/lib/catalog/roles";
import type { Passage } from "@/lib/types";

let patient: PatientRecord;
beforeAll(() => {
  setupSyntheticPatient();
  return import("@/lib/data/patients").then((m) => {
    patient = m.getPatient("9999-0001")!;
  });
});

function passage(text: string): Passage {
  const p = patient.passages.find((x) => x.text.includes(text));
  if (!p) throw new Error(`no passage containing ${text}`);
  return p;
}

const planned: PlannedItem[] = [
  { key: "allergies", label: "Allergies", guidance: "" },
  { key: "antithrombotics", label: "Antithrombotics", guidance: "" },
  { key: "contrast_safety", label: "Contrast safety", guidance: "" },
];

describe("itemsFromModel", () => {
  const ctx = () => verifyContext(patient);

  it("marks a planned item the model skipped as unverified", () => {
    const { items } = itemsFromModel({ items: [] }, planned, ctx(), "s");
    expect(items).toHaveLength(3);
    for (const i of items) {
      expect(i.status).toBe("unverified");
      expect(i.note).toContain("No answer was returned");
    }
  });

  it("keeps verified facts and marks the item documented", () => {
    const raw = {
      items: [
        {
          key: "allergies",
          status: "documented",
          facts: [{ statement: "Penicillin allergy (rash)", quotes: [{ passageId: passage("Penicillin").id, text: "Penicillin-Allergie (Exanthem)" }] }],
        },
      ],
    };
    const { items, rejected } = itemsFromModel(raw, planned, ctx(), "s");
    const allergies = items.find((i) => i.key === "allergies")!;
    expect(allergies.status).toBe("documented");
    expect(allergies.facts).toHaveLength(1);
    expect(rejected).toHaveLength(0);
  });

  it("drops facts that fail verification and reports them as rejected", () => {
    const raw = {
      items: [
        {
          key: "antithrombotics",
          status: "documented",
          facts: [{ statement: "Clopidogrel 75 mg 1-0-0", quotes: [{ passageId: passage("Eliquis").id, text: "Clopidogrel 75mg" }] }],
        },
      ],
    };
    const { items, rejected } = itemsFromModel(raw, planned, ctx(), "cardio");
    expect(items.find((i) => i.key === "antithrombotics")!.status).toBe("unverified");
    expect(rejected).toEqual([expect.objectContaining({ section: "cardio", item: "antithrombotics", statement: "Clopidogrel 75 mg 1-0-0" })]);
  });

  it("turns 'not documented' model answers into not_documented items", () => {
    const raw = { items: [{ key: "contrast_safety", status: "not_documented", note: "No contrast reaction documented." }] };
    const { items } = itemsFromModel(raw, planned, ctx(), "s");
    const item = items.find((i) => i.key === "contrast_safety")!;
    expect(item.status).toBe("not_documented");
    expect(item.note).toBe("No contrast reaction documented.");
    expect(item.facts).toEqual([]);
  });

  it("turns absence-claim facts into not_documented notes", () => {
    const raw = {
      items: [
        {
          key: "contrast_safety",
          status: "documented",
          facts: [{ statement: "No contrast reaction is documented in the records.", quotes: [] }],
        },
      ],
    };
    const { items } = itemsFromModel(raw, planned, ctx(), "s");
    const item = items.find((i) => i.key === "contrast_safety")!;
    expect(item.status).toBe("not_documented");
    expect(item.note).toContain("No contrast reaction");
  });

  it("derives the plan from raw items when nothing was planned", () => {
    const raw = { items: [{ key: "answer_1", label: "Anticoagulation", status: "not_documented" }] };
    const { items } = itemsFromModel(raw, [], ctx(), "chat");
    expect(items).toEqual([expect.objectContaining({ key: "answer_1", label: "Anticoagulation", status: "not_documented" })]);
  });
});

describe("isAbsenceClaim", () => {
  it("matches statements about the records", () => {
    expect(isAbsenceClaim("No allergy testing was documented.")).toBe(true);
    expect(isAbsenceClaim("Nothing was recorded about smoking.")).toBe(true);
    expect(isAbsenceClaim("No MRI found in the documents.")).toBe(true);
  });
  it("does not match documented negative findings", () => {
    expect(isAbsenceClaim("No oedema on examination (3 May 2020).")).toBe(false);
    expect(isAbsenceClaim("Patient denies chest pain.")).toBe(false);
  });
});

describe("demographicsItem", () => {
  it("quotes the birth date and reports the calculated age", () => {
    const item = demographicsItem(patient);
    expect(item.status).toBe("documented");
    expect(item.facts[0].kind).toBe("calculated");
    expect(item.facts[0].statement).toBe("70 years old at the latest document (1 Sep 2020); born 1 Feb 1950.");
    expect(item.facts[0].quotes[0].text).toBe("01.02.1950");
  });
});

describe("weightTrendItem", () => {
  it("shows the weighings as one trend line in date order with the calculated change", () => {
    const item = weightTrendItem(patient)!;
    expect(item.status).toBe("documented");
    expect(item.facts).toHaveLength(1);
    const [trend] = item.facts;
    expect(trend.statement).toBe("Weight 80 kg (20 Mar 2020) → 72 kg (1 Sep 2020); change −8 kg.");
    expect(trend.kind).toBe("calculated");
    expect(trend.calculation?.result).toBe(-8);
    // Every shown value links to its own document
    expect(new Set(trend.quotes.map((q) => q.passageId.split(":")[0])).size).toBe(2);
  });

  it("returns null when no weight is documented", () => {
    const empty: PatientRecord = { ...patient, documents: [], passages: [], latestDocumentDate: "" };
    expect(weightTrendItem(empty)).toBeNull();
  });

  it("omits the change for a single weighing", () => {
    const one: PatientRecord = {
      ...patient,
      documents: [patient.documents[0]],
      passages: patient.passages.filter((p) => p.docId === "900001"),
    };
    const item = weightTrendItem(one)!;
    expect(item.facts).toHaveLength(1);
    expect(item.facts[0].statement).toBe("Weight 80 kg (20 Mar 2020).");
  });
});

describe("weightTrendItem with many weighings", () => {
  it("keeps the first and the latest values and skips the middle", () => {
    const base = patient.passages.find((p) => /^\s*Gewicht:/i.test(p.text))!;
    const docs = ["2020-01-01", "2020-02-01", "2020-03-01", "2020-04-01", "2020-05-01", "2020-06-01"].map((date, i) => ({
      ...patient.documents[0],
      id: `doc${i}`,
      date,
    }));
    const many: PatientRecord = {
      ...patient,
      documents: docs,
      passages: docs.map((d, i) => ({ ...base, id: `${d.id}:1`, docId: d.id, text: `Gewicht: ${90 - i} kg` })),
    };
    const [trend] = weightTrendItem(many)!.facts;
    expect(trend.statement).toBe("Weight 90 kg (1 Jan 2020) … → 87 kg (1 Apr 2020) → 86 kg (1 May 2020) → 85 kg (1 Jun 2020); change −5 kg.");
    expect(trend.quotes).toHaveLength(4);
  });
});

describe("retrievalItems", () => {
  it("returns the newest matching passages for a planned category", () => {
    const [item] = retrievalItems(patient, [{ key: "allergies", label: "Allergies", guidance: "" }]);
    expect(item.status).toBe("documented");
    expect(item.facts[0].statement).toContain("Penicillin-Allergie");
    expect(item.facts[0].quotes[0].passageId).toBe(passage("Penicillin").id);
  });

  it("reports not_documented when no passage matches", () => {
    const [item] = retrievalItems(patient, [{ key: "blood_pressure", label: "Blood pressure", guidance: "" }]);
    expect(item.status).toBe("not_documented");
    expect(item.note).toContain("keyword search");
  });

  it("marks unknown categories as needing the model", () => {
    const [item] = retrievalItems(patient, [{ key: "custom_topic", label: "Custom", guidance: "" }]);
    expect(item.status).toBe("unverified");
  });
});
