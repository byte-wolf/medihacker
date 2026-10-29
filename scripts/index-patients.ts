// Pre-computes contradictions (rules + LLM scan) and passage translations for every patient.
import "./env";
import { listPatients, getPatient } from "@/lib/data/patients";
import { awaitContradictionScan, ensureContradictions, listContradictions } from "@/lib/contradictions/store";
import { ensureTranslations } from "@/lib/data/translations";

async function main() {
  for (const summary of listPatients()) {
    const patient = getPatient(summary.id)!;
    const started = Date.now();
    ensureContradictions(patient);
    await Promise.all([awaitContradictionScan(patient.id), ensureTranslations(patient)]);
    const found = listContradictions(patient.id);
    console.log(`${patient.id}: ${patient.passages.length} passages, ${found.length} contradictions (${Date.now() - started} ms)`);
    for (const c of found) console.log(`  [${c.detectedBy}/${c.severity}] ${c.title}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
