import { describe, expect, it } from "vitest";
import { claimedNumbers, numbersIn, verifyFact, type VerifyContext } from "@/lib/briefing/verify";
import type { Passage, SourceDocument } from "@/lib/types";
import { itemsFromModel } from "@/lib/briefing/items";

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
  it.each([
    { passage_ids: ["d2:p001"], quote_german: "Gewicht: 66 kg" },
    { passageIds: ["d2:p001"], quote: "Gewicht: 66 kg" },
    { passageId: "d2:p001", quote: "Gewicht: 66 kg" },
  ])("verifies citation spelling variants against the same original evidence: %j", (citation) => {
    const result = itemsFromModel({ items: [{ key: "weight", status: "documented", facts: [
      { statement: "Weight 66 kg (15 April 2016)", ...citation },
    ] }] }, [], ctx, "chat");
    expect(result.rejected).toEqual([]);
    expect(result.items[0].facts[0].quotes).toEqual([{ passageId: "d2:p001", text: "Gewicht: 66 kg" }]);
  });

  it("still rejects invented quantities and quotes using alternate citation spellings", () => {
    const result = itemsFromModel({ items: [{ key: "weight", status: "documented", facts: [
      { statement: "Weight 90 kg", passageIds: ["d2:p001"], quote: "Gewicht: 66 kg" },
      { statement: "Weight 90 kg", passageId: "d2:p001", quote: "Gewicht: 90 kg" },
      { statement: "Weight 66 kg", passageIds: ["d1:p002", "d2:p001"], quote: "Gewicht: 66 kg" },
    ] }] }, [], ctx, "chat");
    expect(result.items[0].status).toBe("unverified");
    expect(result.rejected).toHaveLength(3);
  });
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
  it("normalises decimal commas and roman numerals in sources", () => {
    const n = numbersIn("HbA1c 6,4% Typ II");
    expect(n.has("6.4")).toBe(true);
    expect(n.has("2")).toBe(true);
  });
});
