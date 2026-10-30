import fs from "node:fs";
import path from "node:path";
import { decodeDocumentText } from "./parse";
import { dataDir, type PatientRecord } from "./patients";

// Structured extracts that ship next to the documents in every patient folder
// (cave.json, medication.json, diagnoses.json, procedures.json, scores-latest.json).
// Every value names the documents it was taken from.

export type StructuredNode = {
  id?: string;
  name?: string;
  text?: string;
  status?: string;
  date?: { value: string; type?: string };
  drug?: string;
  agent?: string;
  code?: { catalog: string; value: string; specific?: boolean };
  documentIds?: string[];
  values?: StructuredNode[];
};

export type Score = {
  name: string;
  unit?: string;
  values: { value: string; date: { value: string }; documentIds: string[] }[];
};

export type StructuredData = {
  adverseReactions: string[];
  medication: StructuredNode[];
  diagnoses: StructuredNode[];
  procedures: StructuredNode[];
  scores: Score[];
};

function readOptional<T>(dir: string, file: string): T | null {
  const full = path.join(/*turbopackIgnore: true*/ dir, file);
  if (!fs.existsSync(/*turbopackIgnore: true*/ full)) return null;
  return JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ full, "utf8")) as T;
}

/** Read the patient's structured files; missing files give empty lists. */
export function readStructured(patient: PatientRecord): StructuredData {
  const dir = path.join(/*turbopackIgnore: true*/ dataDir(), patient.folder);
  const cave = readOptional<{ adverseReactions?: { text: string }[] }>(dir, "cave.json");
  const tree = (file: string) => readOptional<{ values?: StructuredNode[] }>(dir, file)?.values ?? [];
  return {
    adverseReactions: (cave?.adverseReactions ?? []).map((a) => cleanText(a.text)),
    medication: tree("medication.json"),
    diagnoses: tree("diagnoses.json"),
    procedures: tree("procedures.json"),
    scores: readOptional<{ scores?: Score[] }>(dir, "scores-latest.json")?.scores ?? [],
  };
}

/** Strip the spell-correction markup some extracted values carry. */
export function cleanText(s: string): string {
  return decodeDocumentText(s).replace(/\s+/g, " ").trim();
}
