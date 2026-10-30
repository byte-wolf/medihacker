import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

const createdAt = () =>
  integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date());

export const llmCache = sqliteTable("llm_cache", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  promptHash: text("prompt_hash").notNull().unique(),
  response: text("response").notNull(),
  createdAt: createdAt(),
});

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull(),
  department: text("department").notNull(),
});

export const situations = sqliteTable("situations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  /** Role named or implied by the situation; null = use the user's role only */
  role: text("role"),
  isPreset: integer("is_preset", { mode: "boolean" }).notNull().default(false),
  /** Questions the question bar suggests for this situation */
  suggestedQuestions: text("suggested_questions", { mode: "json" }).$type<string[]>(),
  createdByUserId: integer("created_by_user_id").references(() => users.id),
  createdAt: createdAt(),
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
  (t) => [primaryKey({ columns: [t.userId, t.situationId] })],
);

export const patientIndex = sqliteTable("patient_index", {
  patientId: text("patient_id").primaryKey(),
  docHash: text("doc_hash").notNull(),
  promptVersion: text("prompt_version").notNull(),
  /** "rules" when only deterministic checks ran, "rules+llm" when the LLM scan also ran */
  contradictionMode: text("contradiction_mode").notNull(),
  indexedAt: createdAt(),
});

export const passageTranslations = sqliteTable("passage_translations", {
  passageId: text("passage_id").primaryKey(),
  patientId: text("patient_id").notNull(),
  docHash: text("doc_hash").notNull(),
  translation: text("translation").notNull(),
});

export const contradictions = sqliteTable("contradictions", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull(),
  title: text("title").notNull(),
  explanation: text("explanation").notNull(),
  severity: text("severity", { enum: ["high", "medium", "low"] }).notNull(),
  categories: text("categories", { mode: "json" }).$type<string[]>().notNull(),
  passageIds: text("passage_ids", { mode: "json" }).$type<string[]>().notNull(),
  detectedBy: text("detected_by", { enum: ["rule", "llm"] }).notNull(),
  createdAt: createdAt(),
});

export const conversations = sqliteTable("conversations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  patientId: text("patient_id").notNull(),
  situationId: integer("situation_id").references(() => situations.id),
  createdAt: createdAt(),
});

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversations.id),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  /** user: { text }, assistant: { items: BriefingItem[] } */
  content: text("content", { mode: "json" }).notNull(),
  latencyMs: integer("latency_ms"),
  createdAt: createdAt(),
});

export const auditLog = sqliteTable("audit_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id),
  patientId: text("patient_id"),
  action: text("action").notNull(),
  details: text("details", { mode: "json" }),
  createdAt: createdAt(),
});

/** Documents users create for a patient, e.g. the preoperative anaesthesia checklist. */
export const patientDocuments = sqliteTable("patient_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  patientId: text("patient_id").notNull(),
  type: text("type").notNull(),
  /** The completed form as entered (type-specific JSON) */
  content: text("content", { mode: "json" }).notNull(),
  /** ASA class confirmed by the user (checklist only) */
  asaClass: text("asa_class"),
  createdAt: createdAt(),
});
