import type { PatientRecord } from "./patients";

/** Allergy lines from the "Allergien" sections of the newest document that has one (CAVE banner, checklist). */
export function allergyLines(patient: PatientRecord): { passageId: string; text: string }[] {
  const latestAllergyDoc = [...patient.documents]
    .reverse()
    .find((d) => patient.passages.some((p) => p.docId === d.id && /allergi/i.test(p.section ?? "")));
  return patient.passages
    .filter((p) => p.docId === latestAllergyDoc?.id && /allergi/i.test(p.section ?? "") && /allergi|unverträglich/i.test(p.text))
    .map((p) => ({ passageId: p.id, text: p.text }));
}
