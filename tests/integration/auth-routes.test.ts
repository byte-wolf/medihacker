import { beforeAll, describe, expect, it, vi } from "vitest";
import { setupSyntheticPatient } from "../helpers/synthetic";

// A cookie jar standing in for the browser, wired into next/headers.
const jar = vi.hoisted(() => ({ store: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.store.has(name) ? { name, value: jar.store.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.store.set(name, value),
    delete: (name: string) => void jar.store.delete(name),
  }),
}));

import { POST as login } from "@/app/api/login/route";
import { POST as logout } from "@/app/api/logout/route";
import { GET as listConversations, POST as openConversation } from "@/app/api/conversations/route";
import { POST as createSituation } from "@/app/api/situations/route";
import { GET as getDocument } from "@/app/api/documents/[patientId]/[docId]/route";

let db: ReturnType<typeof import("@/lib/db").getDb>;
let schema: typeof import("@/lib/db/schema");

const json = (url: string, body?: unknown) =>
  new Request(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });

beforeAll(async () => {
  setupSyntheticPatient();
  db = (await import("@/lib/db")).getDb();
  schema = await import("@/lib/db/schema");
});

describe("POST /api/login", () => {
  it("rejects an unknown user name with 404", async () => {
    const res = await login(json("/api/login", { username: "nobody" }));
    expect(res.status).toBe(404);
    expect(jar.store.has("mh_session")).toBe(false);
  });

  it("rejects a missing user name", async () => {
    const res = await login(json("/api/login", {}));
    expect(res.status).toBe(404);
  });

  it("logs a known user in, sets a signed cookie and audits it", async () => {
    const res = await login(json("/api/login", { username: "SURGEON" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(jar.store.get("mh_session")).toMatch(/^\d+\.[0-9a-f]{32}$/);
    const last = db.select().from(schema.auditLog).all().at(-1)!;
    expect(last.action).toBe("login");
  });
});

describe("authenticated routes", () => {
  it("rejects requests without a session with 401", async () => {
    jar.store.clear();
    const res = await listConversations(new Request("http://localhost/api/conversations?patientId=9999-0001"));
    expect(res.status).toBe(401);
  });

  it("rejects a forged session cookie", async () => {
    jar.store.set("mh_session", "999.deadbeefdeadbeefdeadbeefdeadbeef");
    const res = await listConversations(new Request("http://localhost/api/conversations?patientId=9999-0001"));
    expect(res.status).toBe(401);
  });

  it("lists and opens conversations once logged in", async () => {
    jar.store.clear();
    await login(json("/api/login", { username: "gp" }));

    const list = await listConversations(new Request("http://localhost/api/conversations?patientId=9999-0001"));
    expect(list.status).toBe(200);

    const opened = await openConversation(json("/api/conversations", { patientId: "9999-0001" }));
    expect(opened.status).toBe(200);
    const { conversation } = (await opened.json()) as { conversation: { id: number } };
    expect(conversation.id).toBeGreaterThan(0);
  });

  it("POST /api/conversations validates patientId", async () => {
    const res = await openConversation(json("/api/conversations", {}));
    expect(res.status).toBe(400);
  });

  it("POST /api/situations validates the title", async () => {
    const res = await createSituation(json("/api/situations", { description: "no title" }));
    expect(res.status).toBe(400);
  });

  it("POST /api/situations creates a situation for the logged-in user", async () => {
    const res = await createSituation(json("/api/situations", { title: "Route test", description: "Radiologist review" }));
    expect(res.status).toBe(200);
    const { situation } = (await res.json()) as { situation: { id: number; role: string | null } };
    expect(situation.id).toBeGreaterThan(0);
    expect(situation.role).toBe("Radiologist");
  });

  it("GET /api/documents returns 404 for an unknown patient", async () => {
    const res = await getDocument(new Request("http://localhost/api/documents/none/x"), { params: Promise.resolve({ patientId: "none", docId: "x" }) });
    expect(res.status).toBe(404);
  });

  it("GET /api/documents returns text and passage offsets", async () => {
    const res = await getDocument(new Request("http://localhost/api/documents/9999-0001/900001"), {
      params: Promise.resolve({ patientId: "9999-0001", docId: "900001" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { document: { text: string }; passages: { id: string; start: number; end: number }[]; translations: Record<string, string> };
    expect(body.document.text).toContain("Penicillin-Allergie");
    expect(body.passages.length).toBeGreaterThan(0);
    expect(body.passages[0].id).toMatch(/^900001:p/);
  });
});

describe("POST /api/logout", () => {
  it("clears the session cookie and audits the logout", async () => {
    jar.store.clear();
    await login(json("/api/login", { username: "gp" }));
    const res = await logout();
    expect(res.status).toBe(200);
    expect(jar.store.has("mh_session")).toBe(false);
    expect(db.select().from(schema.auditLog).all().at(-1)!.action).toBe("logout");

    // The next request is unauthenticated again.
    const res2 = await listConversations(new Request("http://localhost/api/conversations?patientId=9999-0001"));
    expect(res2.status).toBe(401);
  });
});
