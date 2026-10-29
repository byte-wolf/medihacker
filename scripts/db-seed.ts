/**
 * db-seed.ts — Idempotent seed for MediHacker.
 * Run with: npm run db:seed
 */
import "dotenv/config";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import * as schema from "../lib/db/schema";

const dbPath = process.env.DATABASE_URL ?? "./medihacker.db";
const sqlite = new Database(dbPath);
const db = drizzle(sqlite, { schema });

// ── Run migrations inline (create tables if missing) ─────────────────────────

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS llm_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt_hash TEXT NOT NULL UNIQUE,
    response TEXT NOT NULL,
    patient_id TEXT,
    situation_hash TEXT,
    role TEXT,
    prompt_version TEXT,
    latency_ms INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL,
    department TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS situations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    created_by_user_id INTEGER REFERENCES users(id),
    role TEXT,
    is_preset INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS user_situations (
    user_id INTEGER NOT NULL REFERENCES users(id),
    situation_id INTEGER NOT NULL REFERENCES situations(id),
    UNIQUE(user_id, situation_id)
  );

  CREATE TABLE IF NOT EXISTS patients_index (
    patient_id TEXT PRIMARY KEY,
    doc_hash TEXT NOT NULL,
    indexed_at INTEGER NOT NULL DEFAULT (unixepoch()),
    prompt_version TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS passages (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    doc_id TEXT NOT NULL,
    section TEXT NOT NULL,
    text TEXT NOT NULL,
    translation TEXT,
    start_offset INTEGER NOT NULL,
    end_offset INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS contradictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id TEXT NOT NULL,
    title TEXT NOT NULL,
    explanation TEXT NOT NULL,
    severity TEXT NOT NULL,
    categories TEXT NOT NULL,
    passage_ids TEXT NOT NULL,
    detected_by TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    patient_id TEXT NOT NULL,
    situation_id INTEGER REFERENCES situations(id),
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id),
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    latency_ms INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    patient_id TEXT,
    action TEXT NOT NULL,
    details TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

// ── Seed users ────────────────────────────────────────────────────────────────

const SEED_USERS = [
  { username: "anaesthesia", displayName: "Dr. A. Fischer", role: "Anaesthetist", department: "Anaesthesiology" },
  { username: "surgeon", displayName: "Dr. B. Weber", role: "Breast surgeon", department: "Surgery" },
  { username: "gp", displayName: "Dr. C. Müller", role: "General practitioner", department: "Primary care" },
  { username: "ed", displayName: "Dr. D. Braun", role: "Emergency physician", department: "Emergency department" },
  { username: "pharmacist", displayName: "E. Schmidt", role: "Clinical pharmacist", department: "Pharmacy" },
  { username: "oncologist", displayName: "Dr. F. Klein", role: "Oncologist", department: "Oncology" },
  { username: "nurse", displayName: "G. Hoffmann", role: "Ward nurse", department: "Surgery ward" },
  { username: "radiologist", displayName: "Dr. H. Becker", role: "Radiologist", department: "Radiology" },
] as const;

for (const u of SEED_USERS) {
  const existing = db.select().from(schema.users).where(eq(schema.users.username, u.username)).get();
  if (!existing) {
    db.insert(schema.users).values(u).run();
    console.log(`  ✓ user: ${u.username}`);
  } else {
    console.log(`  · user already exists: ${u.username}`);
  }
}

// ── Seed preset situations ────────────────────────────────────────────────────

interface PresetSituation {
  title: string;
  description: string;
  role: string;
  assignTo: string[]; // usernames
}

const PRESET_SITUATIONS: PresetSituation[] = [
  {
    title: "Pre-operative anaesthesia check",
    description:
      "You are the anaesthetist. She is scheduled for a quadrantectomy (partial removal of the breast) with intraoperative radiotherapy on 16 May 2016.",
    role: "Anaesthetist",
    assignTo: ["anaesthesia"],
  },
  {
    title: "Surgery planning after the tumour board, April 2016",
    description:
      "You are the surgeon planning her operation after the tumour board.",
    role: "Breast surgeon",
    assignTo: ["surgeon"],
  },
  {
    title: "Diabetes review at the GP",
    description:
      "You are her general practitioner (GP), reviewing her diabetes in spring 2016.",
    role: "General practitioner",
    assignTo: ["gp"],
  },
  {
    title: "Emergency department at night",
    description:
      "You are the emergency physician on night duty. She arrives at 02:00 with dizziness and blurred vision in the left eye.",
    role: "Emergency physician",
    assignTo: ["ed"],
  },
  {
    title: "Open follow-ups from the 2015 hospital stay",
    description:
      "You are her GP. You check which follow-ups from her June 2015 hospital stay are still open.",
    role: "General practitioner",
    assignTo: ["gp"],
  },
];

for (const s of PRESET_SITUATIONS) {
  // Find the assigning user to set created_by (use first assigned user)
  const firstUser = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, s.assignTo[0]))
    .get();

  let sitId: number;
  const existing = db
    .select()
    .from(schema.situations)
    .where(eq(schema.situations.title, s.title))
    .get();

  if (!existing) {
    const result = db
      .insert(schema.situations)
      .values({
        title: s.title,
        description: s.description,
        createdByUserId: firstUser?.id ?? null,
        role: s.role,
        isPreset: true,
      })
      .returning({ id: schema.situations.id })
      .get();
    sitId = result.id;
    console.log(`  ✓ situation: "${s.title}"`);
  } else {
    sitId = existing.id;
    console.log(`  · situation already exists: "${s.title}"`);
  }

  // Assign to all listed users
  for (const username of s.assignTo) {
    const user = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .get();
    if (!user) continue;

    const linkExists = db
      .select()
      .from(schema.userSituations)
      .where(
        eq(schema.userSituations.userId, user.id)
      )
      .all()
      .find((r) => r.situationId === sitId);

    if (!linkExists) {
      db
        .insert(schema.userSituations)
        .values({ userId: user.id, situationId: sitId })
        .run();
      console.log(`    ✓ assigned to: ${username}`);
    }
  }
}

console.log("\n✅ Seed complete.");
sqlite.close();
