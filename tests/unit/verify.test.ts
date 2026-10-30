import { describe, expect, it } from "vitest";
import { claimedNumbers, numbersIn, verifyFact, type VerifyContext } from "@/lib/briefing/verify";
import type { Passage, SourceDocument } from "@/lib/types";

const passages: Passage[] = [
  { id: "d1:p001", docId: "d1", section: "Entlassungsmedikation", kind: "line", text: "Thrombo ASS 100mg oral 1 0 0 0 ST", start: 0, end: 0 },
  { id: "d1:p002", docId: "d1", section: "Befunde", kind: "line", text: "Gewicht: 78 kg", start: 0, end: 0 },
  { id: "d2:p001", docId: "d2", section: "Befunde", kind: "line", text: "Gewicht: 66 kg", start: 0, end: 0 },
  { id: "d2:p002", docId: "d2", section: "Diagnosen", kind: "line", text: "Diabetes Mellitus Typ II, HbA1c 6,4%", start: 0, end: 0 },
];
const documents: SourceDocument[] = [
  { id: "d1", title: "Brief", date: "2015-06-28", type: "x", department: "y", text: "" },
  { id: "d2", title: "Brief", date: "2016-04-15", type: "x", department: "y", text: "" },
];
const ctx: VerifyContext = {
  passages: new Map(passages.map((p) => [p.id, p])),
  documents: new Map(documents.map((d) => [d.id, d])),
};

describe("verifyFact", () => {
  it("accepts a fact with a verbatim quote and supported numbers", () => {
    const r = verifyFact(
      { statement: "Thrombo ASS (acetylsalicylic acid) 100 mg, 1-0-0", quotes: [{ passageId: "d1:p001", text: "Thrombo ASS 100mg oral 1 0 0 0" }] },
      ctx,
    );
    expect(r.ok).toBe(true);
  });

  it("rejects a statement with a number that is not in the source", () => {
    const r = verifyFact({ statement: "Thrombo ASS 75 mg 1-0-0", quotes: [{ passageId: "d1:p001", text: "Thrombo ASS 100mg" }] }, ctx);
    expect(r).toMatchObject({ ok: false });
  });

  it("rejects an invented quote", () => {
    const r = verifyFact({ statement: "Marcumar", quotes: [{ passageId: "d1:p001", text: "Marcumar 3mg" }] }, ctx);
    expect(r.ok).toBe(false);
  });

  it("rejects facts without any source", () => {
    expect(verifyFact({ statement: "Weight 78 kg", quotes: [] }, ctx).ok).toBe(false);
  });

  it("re-anchors a verbatim quote cited with the wrong passage id", () => {
    const r = verifyFact({ statement: "Weight 66 kg", quotes: [{ passageId: "d1:p002", text: "Gewicht: 66 kg" }] }, ctx);
    expect(r.ok && r.fact.quotes[0].passageId).toBe("d2:p001");
  });

  it("allows the document date and roman numerals", () => {
    const r = verifyFact(
      { statement: "Type 2 diabetes, HbA1c 6.4% (April 2016)", quotes: [{ passageId: "d2:p002", text: "Diabetes Mellitus Typ II, HbA1c 6,4%" }] },
      ctx,
    );
    expect(r.ok).toBe(true);
  });

  it("recomputes a weight difference and accepts it", () => {
    const r = verifyFact(
      {
        statement: "Weight 78 kg (June 2015) to 66 kg (April 2016): lost 12 kg",
        quotes: [
          { passageId: "d1:p002", text: "Gewicht: 78 kg" },
          { passageId: "d2:p001", text: "Gewicht: 66 kg" },
        ],
        calculation: { type: "difference", inputs: [{ passageId: "d1:p002", value: 78 }, { passageId: "d2:p001", value: 66 }], result: -12 },
      },
      ctx,
    );
    expect(r.ok && r.fact.kind).toBe("calculated");
  });

  it("keeps a documented fact whose attached calculation is malformed", () => {
    const r = verifyFact(
      {
        statement: "Weight 66 kg (April 2016)",
        quotes: [{ passageId: "d2:p001", text: "Gewicht: 66 kg" }],
        calculation: { type: "bmi", inputs: [{ passageId: "d2:p001", value: 66 }], result: 22.8 },
      },
      ctx,
    );
    expect(r.ok && r.fact.kind).toBe("documented");
  });

  it("rejects a wrong calculation", () => {
    const r = verifyFact(
      {
        statement: "lost 20 kg",
        quotes: [{ passageId: "d1:p002", text: "Gewicht: 78 kg" }],
        calculation: { type: "difference", inputs: [{ passageId: "d1:p002", value: 78 }, { passageId: "d2:p001", value: 66 }], result: -20 },
      },
      ctx,
    );
    expect(r.ok).toBe(false);
  });
});

describe("number helpers", () => {
  it("ignores dosing schedules in statements", () => {
    expect(claimedNumbers("Metformin 1000 mg 1-1-1")).toEqual(["1000"]);
  });
  it("reads German dates as day, month and year", () => {
    const n = numbersIn("Quadrantenresektion + IORT am 16.05.2016");
    expect([...n]).toEqual(expect.arrayContaining(["16", "5", "2016"]));
    expect(n.has("16.05")).toBe(false);
  });

  it("normalises decimal commas and roman numerals in sources", () => {
    const n = numbersIn("HbA1c 6,4% Typ II");
    expect(n.has("6.4")).toBe(true);
    expect(n.has("2")).toBe(true);
  });
});

describe("absence claims", async () => {
  const { isAbsenceClaim } = await import("@/lib/briefing/items");
  it("treats statements about missing records as not documented", () => {
    expect(isAbsenceClaim("No genetic testing documented.")).toBe(true);
    expect(isAbsenceClaim("Kidney function is not recorded in any document.")).toBe(true);
  });
  it("keeps documented negative findings", () => {
    expect(isAbsenceClaim("No enlarged axillary lymph nodes on ultrasound (12 Apr 2016).")).toBe(false);
  });
});

describe("re-anchoring and derived differences", () => {
  const passages: Passage[] = [
    { id: "d1:p001", docId: "d1", section: "Diagnosen", kind: "line", text: "SLE", start: 0, end: 0 },
    { id: "d1:p002", docId: "d1", section: "Diagnosen", kind: "line", text: "HLP", start: 0, end: 0 },
    { id: "d1:p003", docId: "d1", section: "Befunde", kind: "line", text: "Gewicht: 78 kg", start: 0, end: 0 },
    { id: "d2:p001", docId: "d2", section: "Befunde", kind: "line", text: "Gewicht: 66 kg", start: 0, end: 0 },
  ];
  const c: VerifyContext = { passages: new Map(passages.map((p) => [p.id, p])), documents: new Map(documents.map((d) => [d.id, d])) };

  it("re-anchors a short quote to the exact passage in the same document", () => {
    const r = verifyFact({ statement: "Systemic lupus erythematosus", quotes: [{ passageId: "d1:p002", text: "SLE" }] }, c);
    expect(r.ok && r.fact.quotes[0].passageId).toBe("d1:p001");
  });

  it("accepts an undeclared difference of two cited numbers as calculated", () => {
    const r = verifyFact(
      { statement: "Weight fell from 78 kg to 66 kg (−12 kg).", quotes: [{ passageId: "d1:p003", text: "Gewicht: 78 kg" }, { passageId: "d2:p001", text: "Gewicht: 66 kg" }] },
      c,
    );
    expect(r.ok && r.fact.kind).toBe("calculated");
  });

  it("still rejects a number that is not a difference of cited numbers", () => {
    const r = verifyFact(
      { statement: "Weight fell from 78 kg to 66 kg (−17 kg).", quotes: [{ passageId: "d1:p003", text: "Gewicht: 78 kg" }, { passageId: "d2:p001", text: "Gewicht: 66 kg" }] },
      c,
    );
    expect(r.ok).toBe(false);
  });
});

describe("quotes across neighbouring passages", () => {
  const passages: Passage[] = [
    { id: "h:p001", docId: "h", section: "Befund", kind: "line", text: "Durchgängiger Sinusrhythmus mit HF von 47 - 100 (67)/min;", start: 0, end: 57 },
    { id: "h:p002", docId: "h", section: "Befund", kind: "line", text: "keine Pausen;", start: 58, end: 71 },
  ];
  const c: VerifyContext = { passages: new Map(passages.map((p) => [p.id, p])), documents: new Map([["h", { id: "h", title: "EKG", date: "2015-06-12", type: "x", department: "y", text: "" }]]) };
  it("links both passages when a verbatim quote spans two lines", () => {
    const r = verifyFact(
      { statement: "Sinus rhythm, heart rate 47–100/min, no pauses (June 2015).", quotes: [{ passageId: "h:p001", text: "Sinusrhythmus mit HF von 47 - 100 (67)/min; keine Pausen" }] },
      c,
    );
    expect(r.ok && r.fact.quotes.map((q) => q.passageId)).toEqual(["h:p001", "h:p002"]);
  });
});
