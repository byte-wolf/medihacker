import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import { seed } from "./seed";

type Db = BetterSQLite3Database<typeof schema>;

const globalForDb = globalThis as unknown as { __medihackerDb?: Db };

function open(): Db {
  const dbPath = process.env.DATABASE_URL ?? "./medihacker.db";
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  // Apply migrations and seed on first use so a fresh checkout works without extra steps.
  migrate(db, { migrationsFolder: path.join(/*turbopackIgnore: true*/ process.cwd(), "drizzle") });
  seed(db);
  return db;
}

/** Process-wide database singleton (survives Next.js dev hot reloads). */
export function getDb(): Db {
  globalForDb.__medihackerDb ??= open();
  return globalForDb.__medihackerDb;
}

export { schema };
export type { Db };
