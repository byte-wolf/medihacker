/**
 * index-patient.ts — Index all documents for a patient.
 * Run with: npm run index
 *
 * For each patient folder in data/data/:
 *   1. Read all document JSON files.
 *   2. Compute a hash of the combined document content.
 *   3. If the hash is unchanged and the prompt version matches, skip.
 *   4. Parse and segment each document into passages.
 *   5. Translate passages (LLM) and cache results.
 *   6. Store passages in SQLite.
 *   7. Update patients_index.
 */
import "dotenv/config";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import * as schema from "../lib/db/schema";
import { parseDocument, type DocumentJson } from "../lib/indexing/parse";
import { translatePassages } from "../lib/indexing/translate";
import { getLlmProvider } from "../lib/llm/index";

const PROMPT_VERSION = "v1";
const DATA_DIR = path.resolve("data/data");

const dbPath = process.env.DATABASE_URL ?? "./medihacker.db";
const sqlite = new Database(dbPath);
const db = drizzle(sqlite, { schema });

const llm = getLlmProvider();

async function indexPatient(patientDir: string) {
  const patientId = path.basename(patientDir);
  const docsDir = path.join(patientDir, "documents");

  if (!fs.existsSync(docsDir)) {
    console.log(`  Skipping ${patientId}: no documents/ folder`);
    return;
  }

  const docFiles = fs.readdirSync(docsDir).filter((f) => f.endsWith(".json"));
  if (docFiles.length === 0) {
    console.log(`  Skipping ${patientId}: no document JSON files`);
    return;
  }

  const docs: DocumentJson[] = docFiles
    .map((f) => JSON.parse(fs.readFileSync(path.join(docsDir, f), "utf-8")) as DocumentJson)
    .sort((a, b) => a.metadata.date.localeCompare(b.metadata.date));

  // Compute combined hash
  const combined = docs.map((d) => d.text).join("|");
  const docHash = crypto.createHash("sha256").update(combined).digest("hex");

  // Check if re-index is needed
  const existing = db
    .select()
    .from(schema.patientsIndex)
    .where(eq(schema.patientsIndex.patientId, patientId))
    .get();

  if (existing?.docHash === docHash && existing?.promptVersion === PROMPT_VERSION) {
    console.log(`  ✓ ${patientId}: up to date (${docs.length} docs)`);
    return;
  }

  console.log(`  → Indexing ${patientId}: ${docs.length} docs…`);

  // Delete old passages
  sqlite.prepare("DELETE FROM passages WHERE patient_id = ?").run(patientId);

  // Parse and collect passages
  const allPassages: schema.Passage[] = [];
  for (const doc of docs) {
    const parsed = parseDocument(doc);
    for (const p of parsed.passages) {
      allPassages.push({
        id: p.id,
        patientId,
        docId: p.docId,
        section: p.section,
        text: p.text,
        translation: null,
        startOffset: p.startOffset,
        endOffset: p.endOffset,
      });
    }
  }

  console.log(`     Parsed ${allPassages.length} passages`);

  // Translate passages
  console.log(`     Translating passages (LLM)…`);
  const translations = await translatePassages(
    allPassages.map((p) => ({ id: p.id, text: p.text })),
    llm
  );

  // Store in DB
  const insertPassage = sqlite.prepare(`
    INSERT OR REPLACE INTO passages
      (id, patient_id, doc_id, section, text, translation, start_offset, end_offset)
    VALUES
      (@id, @patientId, @docId, @section, @text, @translation, @startOffset, @endOffset)
  `);

  const insertMany = sqlite.transaction((rows: typeof allPassages) => {
    for (const p of rows) {
      insertPassage.run({
        id: p.id,
        patientId: p.patientId,
        docId: p.docId,
        section: p.section,
        text: p.text,
        translation: translations.get(p.id) ?? null,
        startOffset: p.startOffset,
        endOffset: p.endOffset,
      });
    }
  });

  insertMany(allPassages);

  // Update patients_index
  sqlite.prepare(`
    INSERT OR REPLACE INTO patients_index (patient_id, doc_hash, indexed_at, prompt_version)
    VALUES (?, ?, unixepoch(), ?)
  `).run(patientId, docHash, PROMPT_VERSION);

  console.log(`  ✅ ${patientId}: indexed ${allPassages.length} passages`);
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) {
    console.error(`❌  data/ folder not found at ${DATA_DIR}`);
    console.error("    Clone the hackathon data repository and place it at ./data/");
    process.exit(1);
  }

  const patientDirs = fs
    .readdirSync(DATA_DIR)
    .filter((f) => fs.statSync(path.join(DATA_DIR, f)).isDirectory())
    .map((f) => path.join(DATA_DIR, f));

  console.log(`Indexing ${patientDirs.length} patient(s)…\n`);

  for (const dir of patientDirs) {
    await indexPatient(dir);
  }

  console.log("\n✅ Indexing complete.");
  sqlite.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
