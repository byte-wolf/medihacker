import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const llmCache = sqliteTable("llm_cache", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  promptHash: text("prompt_hash").notNull().unique(),
  response: text("response").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
