import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { roleHintFor } from "@/lib/db/seed";

// Small data-access layer for situations, conversations and the audit log.

export type SituationRow = typeof schema.situations.$inferSelect;

export function logAudit(userId: number | null, patientId: string | null, action: string, details?: unknown) {
  getDb().insert(schema.auditLog).values({ userId, patientId, action, details: details ?? null }).run();
}

/** The user's own and assigned situations first, then the hackathon's example cases. */
export function situationsForUser(userId: number): { mine: SituationRow[]; presets: SituationRow[] } {
  const db = getDb();
  const linked = db
    .select({ id: schema.userSituations.situationId })
    .from(schema.userSituations)
    .where(eq(schema.userSituations.userId, userId))
    .all()
    .map((r) => r.id);
  const mine = linked.length
    ? db.select().from(schema.situations).where(inArray(schema.situations.id, linked)).orderBy(asc(schema.situations.id)).all()
    : [];
  const presets = db
    .select()
    .from(schema.situations)
    .where(eq(schema.situations.isPreset, true))
    .orderBy(asc(schema.situations.id))
    .all()
    // Other roles' example situations stay out of the list; the hackathon's cases stay in for every role.
    .filter((s) => !linked.includes(s.id) && !s.suggestedQuestions);
  return { mine, presets };
}

export function getSituation(id: number): SituationRow | null {
  return getDb().select().from(schema.situations).where(eq(schema.situations.id, id)).get() ?? null;
}

export function createSituation(userId: number, title: string, description: string): SituationRow {
  const db = getDb();
  const hint = roleHintFor(description);
  const [row] = db
    .insert(schema.situations)
    .values({ title, description, role: hint?.role ?? null, createdByUserId: userId })
    .returning()
    .all();
  db.insert(schema.userSituations).values({ userId, situationId: row.id }).onConflictDoNothing().run();
  return row;
}

/** The perspectives a briefing combines: the user's role plus a different role named in the situation. */
export function rolesFor(userRole: string, situation: SituationRow | null): string[] {
  return situation?.role && situation.role !== userRole ? [userRole, situation.role] : [userRole];
}

export function listConversations(userId: number, patientId: string) {
  const db = getDb();
  const convs = db
    .select({
      id: schema.conversations.id,
      situationId: schema.conversations.situationId,
      createdAt: schema.conversations.createdAt,
      situationTitle: schema.situations.title,
    })
    .from(schema.conversations)
    .leftJoin(schema.situations, eq(schema.situations.id, schema.conversations.situationId))
    .where(and(eq(schema.conversations.userId, userId), eq(schema.conversations.patientId, patientId)))
    .orderBy(desc(schema.conversations.id))
    .all();
  const counts = new Map<number, number>();
  for (const m of db.select({ c: schema.messages.conversationId }).from(schema.messages).all()) counts.set(m.c, (counts.get(m.c) ?? 0) + 1);
  return convs.map((c) => ({ ...c, messageCount: counts.get(c.id) ?? 0 })).filter((c) => c.messageCount > 0);
}

export function getConversation(id: number, userId: number) {
  return (
    getDb()
      .select()
      .from(schema.conversations)
      .where(and(eq(schema.conversations.id, id), eq(schema.conversations.userId, userId)))
      .get() ?? null
  );
}

export function createConversation(userId: number, patientId: string, situationId: number | null) {
  const [row] = getDb().insert(schema.conversations).values({ userId, patientId, situationId }).returning().all();
  return row;
}

/** Reuse the latest empty conversation for this context, so reloading the page does not pile up empty ones. */
export function openConversation(userId: number, patientId: string, situationId: number | null) {
  const db = getDb();
  const latest = db
    .select()
    .from(schema.conversations)
    .where(
      and(
        eq(schema.conversations.userId, userId),
        eq(schema.conversations.patientId, patientId),
        situationId === null ? isNull(schema.conversations.situationId) : eq(schema.conversations.situationId, situationId),
      ),
    )
    .orderBy(desc(schema.conversations.id))
    .get();
  if (latest) return latest;
  return createConversation(userId, patientId, situationId);
}

export function listMessages(conversationId: number) {
  return getDb()
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.conversationId, conversationId))
    .orderBy(asc(schema.messages.id))
    .all();
}

export function addMessage(conversationId: number, role: "user" | "assistant", content: unknown, latencyMs?: number) {
  const [row] = getDb().insert(schema.messages).values({ conversationId, role, content, latencyMs: latencyMs ?? null }).returning().all();
  return row;
}

export type PatientDocumentRow = typeof schema.patientDocuments.$inferSelect;

export function createPatientDocument(userId: number, patientId: string, type: string, content: unknown, asaClass: string | null): PatientDocumentRow {
  const [row] = getDb().insert(schema.patientDocuments).values({ userId, patientId, type, content, asaClass }).returning().all();
  return row;
}

export function listPatientDocuments(patientId: string): PatientDocumentRow[] {
  return getDb()
    .select()
    .from(schema.patientDocuments)
    .where(eq(schema.patientDocuments.patientId, patientId))
    .orderBy(desc(schema.patientDocuments.id))
    .all();
}
