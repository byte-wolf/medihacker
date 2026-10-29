import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// A small, made-up German patient used by the tests. It is written for this
// repository and contains no hackathon data.

export const SYNTHETIC_DOCS = [
  {
    id: "900001",
    title: "Stat. Patientenbrief (Interne)",
    date: "2020-03-20",
    type: "Arztbrief(Inter.)",
    department: "Innere Medizin",
    text: [
      "Frau<BR>Testpatientin<BR>Straße 1<BR>PLZ Ort<BR>",
      " Patient(in): TEST_9999 | geb. 01.02.1950<BR>",
      " Fall: 20200310<BR>",
      " Aufnahme am 10/03/2020 | Entlassen am 18/03/2020<BR><BR>",
      "Diagnosen:<BR>Vorhofflimmern<BR>Niereninsuffizienz Stadium III<BR>Diabetes Mellitus Typ II<BR><BR>",
      "Allergien:<BR>Penicillin-Allergie (Exanthem)<BR><BR>",
      "Anamnese:<BR>Die Patientin wurde am 12.03.2020 wegen Atemnot aufgenommen. Pat. berichtete über<BR>",
      "zunehmende Belastungsdyspnoe seit 2 Wochen.<BR><BR>",
      "Erhobene Befunde:<BR>Größe: 160 cm<BR>Gewicht: 80 kg<BR>BMI: 25.0<BR><BR>",
      "Echokardiographie:<BR>Ventrikelfunktion: Leicht reduzierte LV-Funktion (EF 45%)<BR><BR>",
      "Duplex:<BR>Links findet sich eine 70%ige Stenose der A. carotis interna.<BR>",
      "Gesamtbeurteilung<BR>Hochgradige Stenose der A. carotis interna rechts.<BR><BR>",
      "Therapie und Verlauf:<BR>Eine orale Antikoagulation mit Eliquis 5 mg wurde begonnen. Kontrolle der Nierenwerte in 4 Wochen empfohlen.<BR>",
      "Die Patientin konnte am 18.03.2020 entlassen werden.<BR><BR>",
      "Entlassungsmedikation:<BR>Applikation mo mi ab na Einheit Info<BR>",
      "Eliquis 5mg oral 1 0 1 0 ST<BR>Metformin 500mg oral 1 0 1 0 ST<BR>",
      "Mit freundlichen Grüßen<BR> OA Test<BR>",
    ].join(""),
  },
  {
    id: "900002",
    title: "Ambulanter Patientenbrief",
    date: "2020-09-01",
    type: "Ambulanzbrief(Inter.)",
    department: "Kardiologie",
    text: [
      "Frau<BR>Testpatientin<BR> Fall: 20200901<BR>",
      "Vitalparameter:<BR>Größe: 160 cm<BR>Gewicht: 72 kg<BR>BMI: 28,1<BR><BR>",
      "Verlauf:<BR>Die Kreatinin-Kontrolle ergab 1,4 mg/dl. Die Stenose der A. carotis interna links ist unverändert.<BR>",
    ].join(""),
  },
];

/** Write the synthetic patient to a temporary data dir and point the app at it. */
export function setupSyntheticPatient(): { dataDir: string; dbPath: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "medihacker-test-"));
  const dataDir = path.join(root, "data");
  const folder = path.join(dataDir, "patient-9999-0001");
  fs.mkdirSync(path.join(folder, "documents"), { recursive: true });
  fs.writeFileSync(
    path.join(folder, "patient.json"),
    JSON.stringify({ id: "9999-0001", name: "Test Patientin", sex: "female", dateOfBirth: "1950-02-01" }),
  );
  fs.writeFileSync(
    path.join(folder, "documents.json"),
    JSON.stringify({ documents: SYNTHETIC_DOCS.map(({ id, title, date, type, department }) => ({ id, title, date, type, department })) }),
  );
  for (const d of SYNTHETIC_DOCS) {
    fs.writeFileSync(path.join(folder, "documents", `${d.id}.json`), JSON.stringify({ text: d.text }));
  }
  const dbPath = path.join(root, "test.db");
  process.env.PATIENT_DATA_DIR = dataDir;
  process.env.DATABASE_URL = dbPath;
  process.env.LLM_PROVIDER = "mock";
  return { dataDir, dbPath };
}
