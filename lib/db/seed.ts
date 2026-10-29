import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { ROLE_SITUATIONS } from "@/lib/catalog/situations";
import * as schema from "./schema";

export const SEED_USERS = [
  { username: "anaesthesia", displayName: "Dr. Alex Berger", role: "Anaesthetist", department: "Anaesthesiology" },
  { username: "surgeon", displayName: "Dr. Sam Huber", role: "Breast surgeon", department: "Surgery" },
  { username: "gp", displayName: "Dr. Kim Wagner", role: "General practitioner", department: "Primary care" },
  { username: "ed", displayName: "Dr. Robin Maier", role: "Emergency physician", department: "Emergency department" },
  { username: "pharmacist", displayName: "Mag. Jo Fischer", role: "Clinical pharmacist", department: "Pharmacy" },
  { username: "oncologist", displayName: "Dr. Toni Schmid", role: "Oncologist", department: "Oncology" },
  { username: "nurse", displayName: "Charlie Weber", role: "Ward nurse", department: "Surgery ward" },
  { username: "radiologist", displayName: "Dr. Mika Bauer", role: "Radiologist", department: "Radiology" },
] as const;

/** Which seeded user a preset situation belongs to, by the role it names. */
const ROLE_HINTS: { re: RegExp; username: string; role: string }[] = [
  { re: /anaesthetist|anesthetist/i, username: "anaesthesia", role: "Anaesthetist" },
  { re: /surgeon/i, username: "surgeon", role: "Breast surgeon" },
  { re: /general practitioner|\bGP\b/i, username: "gp", role: "General practitioner" },
  { re: /emergency physician/i, username: "ed", role: "Emergency physician" },
  { re: /pharmacist/i, username: "pharmacist", role: "Clinical pharmacist" },
  { re: /oncologist/i, username: "oncologist", role: "Oncologist" },
  { re: /nurse/i, username: "nurse", role: "Ward nurse" },
  { re: /radiologist/i, username: "radiologist", role: "Radiologist" },
];

export type PresetSituation = { title: string; description: string };

/**
 * Read the preset situations (title + description, without the check questions)
 * from the hackathon's cases/situations.md, if the data folder is present.
 */
export function readPresetSituations(file = path.resolve(/*turbopackIgnore: true*/ process.env.CASES_FILE ?? "data/cases/situations.md")): PresetSituation[] {
  if (!fs.existsSync(/*turbopackIgnore: true*/ file)) return [];
  const md = fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8");
  const out: PresetSituation[] = [];
  for (const block of md.split(/^## /m).slice(1)) {
    const [heading, ...rest] = block.split("\n");
    const title = heading.replace(/^\d+\.\s*/, "").trim();
    const description = rest
      .join("\n")
      .split(/^\d+\.\s/m)[0] // stop at the numbered questions
      .trim()
      .replace(/\s+/g, " ");
    if (title && description) out.push({ title, description });
  }
  return out;
}

export function roleHintFor(text: string) {
  return ROLE_HINTS.find((h) => h.re.test(text)) ?? null;
}

/** Idempotent seed: users, the hackathon's preset situations and three example situations per role. */
export function seed(db: BetterSQLite3Database<typeof schema>) {
  for (const u of SEED_USERS) {
    db.insert(schema.users).values(u).onConflictDoNothing().run();
  }
  const presets = db.select().from(schema.situations).where(eq(schema.situations.isPreset, true)).all();
  const exists = (title: string) => presets.some((p) => p.title === title);
  const link = (username: string, situationId: number) => {
    const user = db.select().from(schema.users).where(eq(schema.users.username, username)).get();
    if (user) db.insert(schema.userSituations).values({ userId: user.id, situationId }).onConflictDoNothing().run();
  };

  for (const s of readPresetSituations()) {
    if (exists(s.title)) continue;
    const hint = roleHintFor(s.description);
    const [row] = db
      .insert(schema.situations)
      .values({ title: s.title, description: s.description, role: hint?.role ?? null, isPreset: true })
      .returning()
      .all();
    if (hint) link(hint.username, row.id);
  }

  for (const user of SEED_USERS) {
    for (const s of ROLE_SITUATIONS[user.role] ?? []) {
      if (exists(s.title)) continue;
      const [row] = db
        .insert(schema.situations)
        .values({ title: s.title, description: s.description, role: user.role, isPreset: true, suggestedQuestions: s.questions })
        .returning()
        .all();
      link(user.username, row.id);
    }
  }
}
