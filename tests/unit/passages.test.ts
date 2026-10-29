import { describe, expect, it } from "vitest";
import { decodeDocumentText } from "@/lib/data/parse";
import { segmentDocument, splitSentences } from "@/lib/data/passages";
import { SYNTHETIC_DOCS } from "../helpers/synthetic";

const doc = SYNTHETIC_DOCS[0];
const text = decodeDocumentText(doc.text);
const passages = segmentDocument(doc.id, text);
const find = (s: string) => passages.find((p) => p.text.includes(s));

describe("segmentDocument", () => {
  it("gives every passage a stable id and exact offsets into the text", () => {
    expect(passages[0].id).toBe("900001:p001");
    for (const p of passages) expect(text.slice(p.start, p.end)).toBe(p.text);
  });

  it("keeps each medication table row as its own passage", () => {
    const row = find("Eliquis 5mg oral");
    expect(row?.text).toBe("Eliquis 5mg oral 1 0 1 0 ST");
    expect(row?.section).toBe("Entlassungsmedikation");
  });

  it("keeps key/value lines (vitals) separate", () => {
    expect(find("Gewicht: 80 kg")?.text).toBe("Gewicht: 80 kg");
    expect(find("BMI: 25.0")?.text).toBe("BMI: 25.0");
  });

  it("joins a sentence broken across lines", () => {
    const p = find("Pat. berichtete");
    expect(p?.text).toContain("zunehmende Belastungsdyspnoe seit 2 Wochen.");
  });

  it("assigns list items to their heading", () => {
    expect(find("Penicillin-Allergie")?.section).toBe("Allergien");
    expect(find("Vorhofflimmern")?.section).toBe("Diagnosen");
  });

  it("composes generic sub-headings with their parent", () => {
    expect(find("Hochgradige Stenose")?.section).toBe("Duplex › Gesamtbeurteilung");
  });
});

describe("splitSentences", () => {
  it("does not split after abbreviations or dates", () => {
    const t = "Pat. kam am 03. April zur Kontrolle. Danach Entlassung.";
    const ranges = splitSentences(t, 0, t.length).map(([s, e]) => t.slice(s, e));
    expect(ranges).toEqual(["Pat. kam am 03. April zur Kontrolle.", "Danach Entlassung."]);
  });
});
