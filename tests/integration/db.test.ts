import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setupSyntheticPatient } from "../helpers/synthetic";

// Boots the real database singleton on a temp file: migrations + seed on first use.
let db: ReturnType<typeof import("@/lib/db").getDb>;
let schema: typeof import("@/lib/db/schema");
let seedMod: typeof import("@/lib/db/seed");

beforeAll(async () => {
  setupSyntheticPatient();
  const m = await import("@/lib/db");
  db = m.getDb();
  schema = await import("@/lib/db/schema");
  seedMod = await import("@/lib/db/seed");
});

function tableNames(): string[] {
  return (db as unknown as { $client: { prepare: (s: string) => { all: () => { name: string }[] } } }).$client
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all()
    .map((r) => r.name);
}

describe("database bootstrap", () => {
  it("creates every application table", () => {
    const tables = tableNames();
    for (const t of ["users", "situations", "user_situations", "patient_index", "passage_translations", "contradictions", "conversations", "messages", "audit_log", "llm_cache"]) {
      expect(tables).toContain(t);
    }
  });

  it("enables WAL mode and foreign keys", () => {
    const client = (db as unknown as { $client: { pragma: (s: string) => unknown[] } }).$client;
    expect(client.pragma("journal_mode")).toEqual([{ journal_mode: "wal" }]);
    expect(client.pragma("foreign_keys")).toEqual([{ foreign_keys: 1 }]);
  });

  it("seeds all demo users", () => {
    const users = db.select().from(schema.users).all();
    expect(users.map((u) => u.username).sort()).toEqual([...seedMod.SEED_USERS.map((u) => u.username)].sort());
    for (const u of users) {
      expect(u.role).toBeTruthy();
      expect(u.department).toBeTruthy();
    }
  });

  it("seeds three preset situations per role with suggested questions", () => {
    const presets = db.select().from(schema.situations).all().filter((s) => s.suggestedQuestions?.length);
    const roles = new Set(seedMod.SEED_USERS.map((u) => u.role));
    const byRole = new Map<string, number>();
    for (const s of presets) byRole.set(s.role!, (byRole.get(s.role!) ?? 0) + 1);
    for (const role of roles) expect(byRole.get(role)).toBe(3);
  });

  it("is idempotent: re-running the seed changes nothing", () => {
    const before = {
      users: db.select().from(schema.users).all().length,
      situations: db.select().from(schema.situations).all().length,
      links: db.select().from(schema.userSituations).all().length,
    };
    seedMod.seed(db);
    expect(db.select().from(schema.users).all()).toHaveLength(before.users);
    expect(db.select().from(schema.situations).all()).toHaveLength(before.situations);
    expect(db.select().from(schema.userSituations).all()).toHaveLength(before.links);
  });
});

describe("readPresetSituations", () => {
  it("returns empty when the cases file is missing", () => {
    expect(seedMod.readPresetSituations("/nonexistent/situations.md")).toEqual([]);
  });

  it("parses title and description, stopping before the numbered questions", () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "medihacker-cases-")), "situations.md");
    fs.writeFileSync(
      file,
      [
        "# Cases",
        "",
        "## 1. Night shift emergency",
        "The patient arrives with dizziness. A CT with contrast is planned.",
        "",
        "1. Which allergies are documented?",
        "2. Is she anticoagulated?",
        "",
        "## 2. Ward round",
        "Routine follow-up after discharge for heart failure.",
        "",
      ].join("\n"),
    );
    const presets = seedMod.readPresetSituations(file);
    expect(presets).toEqual([
      { title: "Night shift emergency", description: "The patient arrives with dizziness. A CT with contrast is planned." },
      { title: "Ward round", description: "Routine follow-up after discharge for heart failure." },
    ]);
  });
});

describe("roleHintFor", () => {
  it("maps situation descriptions to roles", () => {
    expect(seedMod.roleHintFor("Anaesthetist consult before surgery")?.username).toBe("anaesthesia");
    expect(seedMod.roleHintFor("GP follow-up visit")?.username).toBe("gp");
    expect(seedMod.roleHintFor("Emergency physician handover")?.role).toBe("Emergency physician");
  });
  it("returns null when no role is mentioned", () => {
    expect(seedMod.roleHintFor("Routine blood draw")).toBeNull();
  });
});
