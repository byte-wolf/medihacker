import { describe, expect, it } from "vitest";
import { decodeDocumentText, normalizeForMatch } from "@/lib/data/parse";

describe("decodeDocumentText", () => {
  it("turns <BR> into newlines and resolves entities", () => {
    expect(decodeDocumentText("a<BR>b&gt;c &amp; d&#246;")).toBe("a\nb>c & dö");
  });
  it("strips markup such as spell-correction spans", () => {
    expect(decodeDocumentText('<SPAN class="spellcorrection">Herz</SPAN>echo')).toBe("Herzecho");
  });
});

describe("normalizeForMatch", () => {
  it("unifies whitespace, case and decimal commas", () => {
    expect(normalizeForMatch("  HbA1c   von\n6,4%")).toBe("hba1c von 6.4%");
  });
});
