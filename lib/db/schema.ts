import {
  integer,
  sqliteTable,
  text,
  real,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ─── LLM cache ──────────────────────────────────────────────────────────────

export const llmCache = sqliteTable("llm_cache", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  promptHash: text("prompt_hash").notNull().unique(),
  response: text("response").notNull(),
  patientId: text("patient_id"),
  situationHash: text("situation_hash"),
  role: text("role"),
  promptVersion: text("prompt_version"),
  latencyMs: integer("latency_ms"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull(),
  department: text("department").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ─── Situations ──────────────────────────────────────────────────────────────

export const situations = sqliteTable("situations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  createdByUserId: integer("created_by_user_id").references(() => users.id),
  role: text("role"), // nullable → role-agnostic preset
  isPreset: integer("is_preset", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const userSituations = sqliteTable(
  "user_situations",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    situationId: integer("situation_id")
      .notNull()
      .references(() => situations.id),
  },
  (t) => [uniqueIndex("user_situations_uq").on(t.userId, t.situationId)]
);

// ─── Patient index ────────────────────────────────────────────────────────────

export const patientsIndex = sqliteTable("patients_index", {
  patientId: text("patient_id").primaryKey(),
  docHash: text("doc_hash").notNull(),
  indexedAt: integer("indexed_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  promptVersion: text("prompt_version").notNull(),
});

// ─── Passages ────────────────────────────────────────────────────────────────

export const passages = sqliteTable("passages", {
  // stable id format: "docId:pNNN"
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull(),
  docId: text("doc_id").notNull(),
  section: text("section").notNull(), // e.g. "Diagnosen", "Allergien", "Entlassungsmedikation"
  text: text("text").notNull(),
  translation: text("translation"), // English machine translation, cached
  startOffset: integer("start_offset").notNull(),
  endOffset: integer("end_offset").notNull(),
});

// ─── Contradictions ───────────────────────────────────────────────────────────

export const contradictions = sqliteTable("contradictions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientId: text("patient_id").notNull(),
  title: text("title").notNull(),
  explanation: text("explanation").notNull(), // plain-English one-liner
  severity: text("severity").notNull(), // "high" | "medium" | "low"
  categories: text("categories").notNull(), // JSON array of strings
  passageIds: text("passage_ids").notNull(), // JSON array of passage IDs
  detectedBy: text("detected_by").notNull(), // "rule" | "llm"
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ─── Conversations ────────────────────────────────────────────────────────────

export const conversations = sqliteTable("conversations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  patientId: text("patient_id").notNull(),
  situationId: integer("situation_id").references(() => situations.id), // nullable for "None"
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ─── Messages ─────────────────────────────────────────────────────────────────

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversations.id),
  role: text("role").notNull(), // "user" | "assistant"
  content: text("content").notNull(), // JSON: {text, facts?, passageIds?}
  latencyMs: integer("latency_ms"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ─── Audit log ────────────────────────────────────────────────────────────────

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id),
  patientId: text("patient_id"),
  action: text("action").notNull(), // login | open_patient | select_situation | view_briefing | open_source | ask_question
  details: text("details"), // JSON
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ─── Type exports ─────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type Situation = typeof situations.$inferSelect;
export type Passage = typeof passages.$inferSelect;
export type Contradiction = typeof contradictions.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type AuditLog = typeof auditLog.$inferSelect;
