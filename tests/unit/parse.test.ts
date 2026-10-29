import { describe, it, expect } from "vitest";
import {
  htmlToPlainText,
  segmentDocument,
  parseDocument,
  type DocumentJson,
} from "../../lib/indexing/parse";

describe("htmlToPlainText", () => {
  it("converts <BR> tags to newlines", () => {
    expect(htmlToPlainText("line1<BR>line2")).toBe("line1\nline2");
    expect(htmlToPlainText("line1<BR/>line2")).toBe("line1\nline2");
    expect(htmlToPlainText("line1<br>line2")).toBe("line1\nline2");
  });

  it("decodes common HTML entities", () => {
    expect(htmlToPlainText("&amp;")).toBe("&");
    expect(htmlToPlainText("&lt;")).toBe("<");
    expect(htmlToPlainText("&gt;")).toBe(">");
    expect(htmlToPlainText("&auml;")).toBe("ä");
    expect(htmlToPlainText("&ouml;")).toBe("ö");
    expect(htmlToPlainText("&uuml;")).toBe("ü");
    expect(htmlToPlainText("&szlig;")).toBe("ß");
    expect(htmlToPlainText("&deg;")).toBe("°");
    expect(htmlToPlainText("&micro;")).toBe("µ");
  });

  it("strips remaining HTML tags", () => {
    expect(htmlToPlainText("<b>bold</b>")).toBe("bold");
    expect(htmlToPlainText("<span class='x'>text</span>")).toBe("text");
  });

  it("collapses excessive newlines to at most 2", () => {
    const result = htmlToPlainText("a<BR><BR><BR><BR>b");
    expect(result).toBe("a\n\nb");
  });
});

describe("segmentDocument", () => {
  it("returns passages with correct docId prefix in IDs", () => {
    const text = "Diagnosen:\nHypertonie\nDiabetes";
    const passages = segmentDocument("12340001", text);
    expect(passages.length).toBeGreaterThan(0);
    expect(passages[0].id).toMatch(/^12340001:p\d{3}$/);
    expect(passages[0].docId).toBe("12340001");
  });

  it("assigns the Diagnosen section to diagnosis lines", () => {
    const text = "Diagnosen:\nHypertonie\nDiabetes Mellitus";
    const passages = segmentDocument("DOC1", text);
    const diagPassages = passages.filter((p) => p.section === "Diagnosen");
    expect(diagPassages.length).toBeGreaterThanOrEqual(2);
  });

  it("assigns the Allergien section to allergy lines", () => {
    const text = "Allergien:\nKM-Allergie (Übelkeit, Schwindel, Erbrechen)";
    const passages = segmentDocument("DOC1", text);
    const allergyPassages = passages.filter((p) => p.section === "Allergien");
    expect(allergyPassages.length).toBeGreaterThanOrEqual(1);
    expect(allergyPassages[0].text).toContain("KM-Allergie");
  });

  it("creates one passage per vital-sign line", () => {
    const text =
      "Anamnese:\nGröße: 170 cm\nGewicht: 78 kg\nBMI: 29.4\nKörpertemperatur: 36.6°C";
    const passages = segmentDocument("DOC1", text);
    const vitals = passages.filter((p) => /^(Größe|Gewicht|BMI|Körper)/.test(p.text));
    expect(vitals.length).toBe(4);
  });

  it("creates one passage per medication dose-row", () => {
    const text = "Entlassungsmedikation:\nThrombo ASS 100mg 1-0-0\nBlopress 16mg 1-0-1";
    const passages = segmentDocument("DOC1", text);
    const meds = passages.filter((p) => /\d+-\d+-\d+/.test(p.text));
    expect(meds.length).toBe(2);
  });

  it("offsets map back exactly into the plain text", () => {
    const text = "Diagnosen:\nHypertonie\nDiabetes Mellitus";
    const passages = segmentDocument("DOC1", text);
    for (const p of passages) {
      const slice = text.slice(p.startOffset, p.endOffset);
      expect(p.text).toBe(slice);
    }
  });

  it("passage IDs are unique within a document", () => {
    const text =
      "Diagnosen:\nHypertonie\nDiabetes\nAllergien:\nKM-Allergie\nAnamnese:\nDie Patientin kam am Morgen.";
    const passages = segmentDocument("DOC1", text);
    const ids = passages.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("parseDocument", () => {
  it("returns plain text and passages for a real-style document", () => {
    const doc: DocumentJson = {
      metadata: {
        id: "99999",
        title: "Test",
        date: "2016-01-01",
        type: "Arztbrief",
        group: "Patientenbrief",
        division: "Innere",
        hospital: "Test",
        department: "Test",
      },
      text: "Diagnosen:<BR>Hypertonie<BR>Allergien:<BR>KM-Allergie<BR>Anamnese:<BR>Größe: 170 cm<BR>Gewicht: 78 kg",
    };

    const result = parseDocument(doc);
    expect(result.id).toBe("99999");
    expect(result.plainText).toContain("Hypertonie");
    expect(result.passages.length).toBeGreaterThan(0);
  });
});
