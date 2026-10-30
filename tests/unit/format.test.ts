import { describe, expect, it } from "vitest";
import { docKindLabel, docKindShort, formatDate, formatShortDate } from "@/lib/format";

describe("formatDate", () => {
  it("formats ISO dates as 'd Mon y'", () => {
    expect(formatDate("2020-03-20")).toBe("20 Mar 2020");
    expect(formatDate("2016-04-15")).toBe("15 Apr 2016");
    expect(formatDate("1999-12-01")).toBe("1 Dec 1999");
  });

  it("formats year-month without a day", () => {
    expect(formatDate("2020-03")).toBe("Mar 2020");
  });

  it("returns the input for malformed dates", () => {
    expect(formatDate("")).toBe("");
    expect(formatDate("not a date")).toBe("not a date");
    expect(formatDate("20.03.2020")).toBe("20.03.2020");
  });
});

describe("docKindLabel", () => {
  it("maps German discharge letters", () => {
    expect(docKindLabel("Stat. Patientenbrief (Interne)", "Arztbrief(Inter.)")).toBe("Discharge letter");
    expect(docKindLabel("Anything", "Arztbrief")).toBe("Discharge letter");
  });

  it("maps outpatient letters", () => {
    expect(docKindLabel("Ambulanter Patientenbrief", "Ambulanzbrief(Inter.)")).toBe("Outpatient letter");
  });

  it("maps pathology reports", () => {
    expect(docKindLabel("Histologie", "")).toBe("Pathology report");
    expect(docKindLabel("Histopathologischer Befund", "Histo")).toBe("Pathology report");
  });

  it("maps radiology reports and sonography", () => {
    expect(docKindLabel("Radiologischer Befund", "")).toBe("Radiology report");
    expect(docKindLabel("Sonographie der Schilddrüse", "")).toBe("Radiology report");
  });

  it("maps consults and monitoring", () => {
    expect(docKindLabel("Konsilbericht Augenklinik", "")).toBe("Ophthalmology consult");
    expect(docKindLabel("Langzeit-EKG", "")).toBe("Holter ECG");
    expect(docKindLabel("24h-RR Messung", "")).toBe("24-h BP monitoring");
  });

  it("falls back to the document title for unknown types", () => {
    expect(docKindLabel("Laborwerte", "Lab")).toBe("Laborwerte");
    expect(docKindLabel("Pflegeprotokoll", "")).toBe("Pflegeprotokoll");
  });
});

describe("docKindShort", () => {
  it("abbreviates known document kinds", () => {
    expect(docKindShort("Stat. Patientenbrief (Interne)", "Arztbrief(Inter.)")).toBe("Discharge");
    expect(docKindShort("Ambulanter Patientenbrief", "Ambulanzbrief(Inter.)")).toBe("Outpatient");
    expect(docKindShort("Radiologischer Befund", "")).toBe("Radiology");
    expect(docKindShort("24h-RR Messung", "")).toBe("24-h BP");
  });

  it("keeps short unknown titles and truncates long ones", () => {
    expect(docKindShort("Laborwerte", "Lab")).toBe("Laborwerte");
    expect(docKindShort("Pflegeprotokoll der Intensivstation", "")).toBe("Pflegeprotokoll d…");
  });
});

describe("formatShortDate", () => {
  it("omits the year when it matches the reference year", () => {
    expect(formatShortDate("2024-10-25", 2024)).toBe("25 Oct");
    expect(formatShortDate("2023-03-15", 2024)).toBe("15 Mar 2023");
    expect(formatShortDate("2024-10-25")).toBe("25 Oct 2024");
  });

  it("always keeps the year for month-only dates and returns malformed input", () => {
    expect(formatShortDate("2024-03", 2024)).toBe("Mar 2024");
    expect(formatShortDate("not a date", 2024)).toBe("not a date");
  });
});
