import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { setupSyntheticPatient } from "../helpers/synthetic";

// Repo-level integration: real SQLite, seeded users.
let repo: typeof import("@/lib/repo");
let db: ReturnType<typeof import("@/lib/db").getDb>;
let schema: typeof import("@/lib/db/schema");

function userId(username: string): number {
  return db.select().from(schema.users).where(eq(schema.users.username, username)).get()!.id;
}

beforeAll(async () => {
  setupSyntheticPatient();
  repo = await import("@/lib/repo");
  db = (await import("@/lib/db")).getDb();
  schema = await import("@/lib/db/schema");
});

describe("situations", () => {
  it("createSituation links the situation to the user and guesses the role", () => {
    const s = repo.createSituation(userId("anaesthesia"), "Night shift", "Emergency physician consult for dizziness");
    expect(s.id).toBeGreaterThan(0);
    expect(s.role).toBe("Emergency physician");
    const { mine } = repo.situationsForUser(userId("anaesthesia"));
    expect(mine.map((x) => x.id)).toContain(s.id);
  });

  it("situationsForUser separates own/assigned situations from presets", () => {
    const uid = userId("surgeon");
    const own = repo.createSituation(uid, "My case", "Custom description");
    const { mine, presets } = repo.situationsForUser(uid);
    expect(mine.map((s) => s.id)).toContain(own.id);
    // Seeded role situations for this user also land in mine.
    expect(mine.length).toBeGreaterThanOrEqual(4);
    // Presets never include situations already linked to the user.
    expect(presets.map((s) => s.id)).not.toContain(own.id);
    // Other roles' example situations (with suggested questions) stay out.
    expect(presets.every((s) => !s.suggestedQuestions)).toBe(true);
  });

  it("rolesFor adds the situation's role when it differs", () => {
    const surgeon = repo.getSituation(
      db.select().from(schema.situations).all().find((s) => s.role === "Breast surgeon")!.id,
    )!;
    expect(repo.rolesFor("Breast surgeon", surgeon)).toEqual(["Breast surgeon"]);
    const other = repo.createSituation(userId("gp"), "Other", "Oncologist review");
    expect(repo.rolesFor("General practitioner", other)).toEqual(["General practitioner", "Oncologist"]);
    expect(repo.rolesFor("General practitioner", null)).toEqual(["General practitioner"]);
  });
});

describe("conversations", () => {
  it("openConversation reuses the latest conversation for the same context", () => {
    const uid = userId("gp");
    const a = repo.openConversation(uid, "9999-0001", null);
    const b = repo.openConversation(uid, "9999-0001", null);
    expect(b.id).toBe(a.id);
  });

  it("a different situation starts a different conversation", () => {
    const uid = userId("gp");
    const sit = repo.createSituation(uid, "Situation B", "desc");
    const a = repo.openConversation(uid, "9999-0001", null);
    const b = repo.openConversation(uid, "9999-0001", sit.id);
    expect(b.id).not.toBe(a.id);
  });

  it("stores messages in order with latency", () => {
    const uid = userId("gp");
    const conv = repo.createConversation(uid, "9999-0001", null);
    repo.addMessage(conv.id, "user", { text: "Is she anticoagulated?" });
    repo.addMessage(conv.id, "assistant", { items: [] }, 123);
    const msgs = repo.listMessages(conv.id);
    expect(msgs.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(msgs[1].latencyMs).toBe(123);
    expect(msgs[0].content).toEqual({ text: "Is she anticoagulated?" });
  });

  it("listConversations hides empty conversations and counts messages", () => {
    const uid = userId("nurse");
    const empty = repo.createConversation(uid, "9999-0001", null);
    const used = repo.createConversation(uid, "9999-0001", null);
    repo.addMessage(used.id, "user", { text: "hi" });
    const convs = repo.listConversations(uid, "9999-0001");
    expect(convs.map((c) => c.id)).toEqual([used.id]); // newest first, empty one hidden
    expect(convs[0].messageCount).toBe(1);
    expect(convs.map((c) => c.id)).not.toContain(empty.id);
  });

  it("getConversation scopes by user", () => {
    const mine = repo.createConversation(userId("ed"), "9999-0001", null);
    expect(repo.getConversation(mine.id, userId("ed"))?.id).toBe(mine.id);
    expect(repo.getConversation(mine.id, userId("nurse"))).toBeNull();
  });
});

describe("audit log", () => {
  it("records actions with optional details", () => {
    const uid = userId("radiologist");
    repo.logAudit(uid, "9999-0001", "open_patient", { via: "test" });
    const rows = db.select().from(schema.auditLog).all().filter((r) => r.action === "open_patient");
    expect(rows.at(-1)).toMatchObject({ userId: uid, patientId: "9999-0001", details: { via: "test" } });
  });
});
