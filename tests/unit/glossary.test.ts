import { describe, expect, it } from "vitest";
import { GLOSSARY, translationIsSafe } from "@/lib/llm/glossary";
import { chatPrompt, contradictionPrompt, extractionPrompt, translationPrompt } from "@/lib/llm/prompts";
import type { PatientRecord } from "@/lib/data/patients";
import type { Passage } from "@/lib/types";

describe("clinical abbreviations", () => {
  it("defines KM as contrast medium and rules out cow's milk", () => {
    expect(GLOSSARY).toMatch(/KM: Kontrastmittel = contrast medium/);
    expect(GLOSSARY).toMatch(/never Kuhmilch \/ cow's milk/);
  });

  it("rejects a translation of KM as milk", () => {
    expect(translationIsSafe("KM-Allergie (Übelkeit, Schwindel, Erbrechen)", "Cow's milk allergy (nausea, dizziness, vomiting)")).toBe(false);
    expect(translationIsSafe("KM-Allergie", "contrast medium (KM) allergy")).toBe(true);
    // "Milch" in the source is not an abbreviation error.
    expect(translationIsSafe("Milchunverträglichkeit, KM-Gabe problemlos", "milk intolerance, contrast given without problems")).toBe(true);
    expect(translationIsSafe("Laktoseintoleranz", "lactose intolerance, avoid milk")).toBe(true);
  });

  it("is part of every prompt that reads German documents", () => {
    const text = "KM-Allergie";
    const passage: Passage = { id: "1:p001", docId: "1", section: "Allergien", kind: "line", text, start: 0, end: text.length };
    const patient: PatientRecord = {
      id: "test",
      folder: "test",
      name: "Test",
      sex: "female",
      dateOfBirth: "1950-01-01",
      documents: [{ id: "1", title: "Brief", date: "2016-04-15", type: "Arztbrief", department: "Test", text }],
      passages: [passage],
      hash: "h",
      latestDocumentDate: "2016-04-15",
    };
    const prompts = [
      translationPrompt(patient.passages).system,
      extractionPrompt({ patient, roles: ["Anaesthetist"], situation: null, sectionTitle: "Safety", items: [] }).system,
      chatPrompt({ patient, roles: ["Anaesthetist"], situation: null, history: [], question: "Allergies?" }).system,
      contradictionPrompt(patient).system,
    ];
    for (const p of prompts) expect(p).toMatch(/KM[^\n]*contrast medium/);
  });

  it("asks the translation to write abbreviations out", () => {
    expect(translationPrompt([]).system).toMatch(/contrast medium \(KM\) allergy/);
  });
});
