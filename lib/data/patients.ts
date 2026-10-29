import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { decodeDocumentText } from "./parse";
import { segmentDocument } from "./passages";
import type { Passage, PatientSummary, SourceDocument } from "@/lib/types";

export type PatientRecord = {
  id: string;
  folder: string;
  name: string;
  sex: string;
  dateOfBirth: string;
  documents: SourceDocument[];
  passages: Passage[];
  /** Hash over all document texts; changes trigger re-indexing. */
  hash: string;
  latestDocumentDate: string;
};

export function dataDir(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.env.PATIENT_DATA_DIR ?? "./data/data");
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8")) as T;
}

/** Folder names of all patients, e.g. ["patient-0000-0001"]. */
export function listPatientFolders(): string[] {
  const dir = dataDir();
  if (!fs.existsSync(/*turbopackIgnore: true*/ dir)) return [];
  return fs
    .readdirSync(/*turbopackIgnore: true*/ dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(/*turbopackIgnore: true*/ path.join(dir, d.name, "patient.json")))
    .map((d) => d.name)
    .sort();
}

const cache = new Map<string, PatientRecord>();

type RawPatient = { id: string; name: string; sex: string; dateOfBirth: string };
type RawDocIndex = { documents: { id: string; title: string; date: string; type: string; department: string }[] };

function loadFolder(folder: string): PatientRecord {
  const dir = path.join(/*turbopackIgnore: true*/ dataDir(), folder);
  const patient = readJson<RawPatient>(path.join(dir, "patient.json"));
  const index = readJson<RawDocIndex>(path.join(dir, "documents.json"));
  const documents: SourceDocument[] = index.documents
    .map((d) => {
      const raw = readJson<{ text: string }>(path.join(dir, "documents", `${d.id}.json`));
      return {
        id: d.id,
        title: d.title,
        date: d.date,
        type: d.type,
        department: d.department,
        text: decodeDocumentText(raw.text),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const passages = documents.flatMap((d) => segmentDocument(d.id, d.text));
  const hash = crypto
    .createHash("sha256")
    .update(documents.map((d) => d.id + d.text).join("\u0000"))
    .digest("hex")
    .slice(0, 16);
  return {
    id: patient.id,
    folder,
    name: patient.name,
    sex: patient.sex,
    dateOfBirth: patient.dateOfBirth,
    documents,
    passages,
    hash,
    latestDocumentDate: documents.at(-1)?.date ?? "",
  };
}

/** Load a patient by id ("0000-0001") or folder name. Results are memoised per process. */
export function getPatient(idOrFolder: string): PatientRecord | null {
  const cached = cache.get(idOrFolder);
  if (cached) return cached;
  const folder = listPatientFolders().find(
    (f) => f === idOrFolder || f === `patient-${idOrFolder}`,
  );
  if (!folder) return null;
  const record = loadFolder(folder);
  cache.set(record.id, record);
  cache.set(folder, record);
  return record;
}

export function listPatients(): PatientSummary[] {
  return listPatientFolders()
    .map((f) => getPatient(f))
    .filter((p): p is PatientRecord => p !== null)
    .map((p) => ({
      id: p.id,
      name: p.name,
      sex: p.sex,
      dateOfBirth: p.dateOfBirth,
      documentCount: p.documents.length,
      latestDocumentDate: p.latestDocumentDate,
    }));
}

/** Age in whole years at a given ISO date. */
export function ageAt(dateOfBirth: string, isoDate: string): number {
  const [by, bm, bd] = dateOfBirth.split("-").map(Number);
  const [y, m, d] = isoDate.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

export function passageMap(p: PatientRecord): Map<string, Passage> {
  return new Map(p.passages.map((x) => [x.id, x]));
}
