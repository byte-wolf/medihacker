import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

// Checklist pre-fill from the synthetic fixture patients and the save route,
// end to end with a temp database. No LLM is called.

const jar = vi.hoisted(() => ({ store: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.store.has(name) ? { name, value: jar.store.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.store.set(name, value),
    delete: (name: string) => void jar.store.delete(name),
  }),
}));

let patients: typeof import("@/lib/data/patients");
let structured: typeof import("@/lib/data/structured");
let checklist: typeof import("@/lib/documents/anesthesia");
let allergies: typeof import("@/lib/data/allergies");
let route: typeof import("@/app/api/patient-documents/route");
let login: typeof import("@/app/api/login/route");
let db: ReturnType<typeof import("@/lib/db").getDb>;
let schema: typeof import("@/lib/db/schema");

const post = (url: string, body: unknown) =>
  new Request(`http://localhost${url}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

beforeAll(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mh-docs-"));
  process.env.PATIENT_DATA_DIR = path.resolve("tests/fixtures/patients");
  process.env.DATABASE_URL = path.join(root, "test.db");
  process.env.LLM_PROVIDER = "mock";
  patients = await import("@/lib/data/patients");
  structured = await import("@/lib/data/structured");
  checklist = await import("@/lib/documents/anesthesia");
  allergies = await import("@/lib/data/allergies");
  route = await import("@/app/api/patient-documents/route");
  login = await import("@/app/api/login/route");
  db = (await import("@/lib/db")).getDb();
  schema = await import("@/lib/db/schema");
});

function prefill(id: string) {
  const p = patients.getPatient(id)!;
  return checklist.prefillAnesthesia({
    patient: p,
    structured: structured.readStructured(p),
    allergyPassages: allergies.allergyLines(p),
    referenceDate: p.latestDocumentDate,
  });
}

function complete(c: ReturnType<typeof prefill>) {
  return {
    ...c,
    identity: { ...c.identity, confirmed: true },
    allergies: { ...c.allergies, confirmed: true },
    confirmations: { medication: true, diagnoses: true, history: true },
    exam: { ...c.exam, bpSystolic: "150", bpDiastolic: "85", smoking: "former" as const, alcohol: "occasional" as const, mallampati: "II" },
  };
}

describe("checklist pre-fill from the fixture patients", () => {
  it("TEST-0001: medication, conditions, height/weight and ASA III (COPD, coronary disease)", () => {
    const c = prefill("TEST-0001");
    expect(c.identity.name).toBe("Testpatient Otto Beispiel");
    expect(c.medication.map((m) => m.drug)).toContain("Ramipril");
    expect(c.conditions.map((x) => x.label)).toEqual(expect.arrayContaining(["Arterielle Hypertonie", "Chronisch obstruktive Lungenerkrankung"]));
    expect([c.exam.heightCm, c.exam.weightKg]).toEqual(["172", "86"]);
    expect(c.conditions.find((x) => x.label === "Arterielle Hypertonie")!.icd).toContain("I10.90");
    expect(c.conditions.every((x) => x.icd.length > 0)).toBe(true);
    const asa = checklist.suggestAsa(complete(c));
    expect(asa).toMatchObject({ status: "complete", asaClass: "III" });
    if (asa.status === "complete") expect(asa.reasons.map((r) => r.text).join(" ")).toMatch(/COPD/);
  });

  it("TEST-0002: previous operations come from the procedures, ASA II with hypertension", () => {
    const c = prefill("TEST-0002");
    expect(c.surgeries.map((s) => s.label)).toEqual(expect.arrayContaining(["Laparoskopische Cholezystektomie", "Appendektomie"]));
    expect(checklist.suggestAsa(complete(c))).toMatchObject({ asaClass: "II" });
  });

  it("every pre-filled source names a document of that patient", () => {
    for (const id of ["TEST-0001", "TEST-0002", "TEST-0003"]) {
      const docs = new Set(patients.getPatient(id)!.documents.map((d) => d.id));
      const c = prefill(id);
      for (const e of [...c.allergies.entries, ...c.medication, ...c.conditions, ...c.surgeries]) for (const d of e.docIds) expect(docs.has(d)).toBe(true);
    }
  });
});

describe("POST /api/patient-documents", () => {
  it("rejects requests without a session", async () => {
    jar.store.clear();
    const res = await route.POST(post("/api/patient-documents", {}));
    expect(res.status).toBe(401);
  });

  it("refuses to save without confirmations and lists what is missing", async () => {
    await login.POST(post("/api/login", { username: "anaesthesia" }));
    const res = await route.POST(post("/api/patient-documents", { patientId: "TEST-0001", type: "preop-anesthesia", content: prefill("TEST-0001") }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.blockers).toEqual(
      expect.arrayContaining(["Confirm the patient's identity (A).", "Confirm the allergies (B).", "Confirm the current medication (C).", "Confirm the medical history (D)."]),
    );
  });

  it("rejects unknown types and checklists of another patient", async () => {
    const c = { ...complete(prefill("TEST-0001")), asa: { finalClass: "III", emergency: false, note: "" } };
    expect((await route.POST(post("/api/patient-documents", { patientId: "TEST-0001", type: "x", content: c }))).status).toBe(400);
    expect((await route.POST(post("/api/patient-documents", { patientId: "TEST-0002", type: "preop-anesthesia", content: c }))).status).toBe(400);
  });

  it("saves a complete checklist with the confirmed ASA class and audits it", async () => {
    const c = { ...complete(prefill("TEST-0001")), asa: { finalClass: "III", emergency: false, note: "" } };
    const res = await route.POST(post("/api/patient-documents", { patientId: "TEST-0001", type: "preop-anesthesia", content: c }));
    expect(res.status).toBe(200);
    const { document } = await res.json();
    const row = db.select().from(schema.patientDocuments).all().find((r) => r.id === document.id)!;
    expect(row).toMatchObject({ patientId: "TEST-0001", type: "preop-anesthesia", asaClass: "III" });
    expect((row.content as { exam: { mallampati: string } }).exam.mallampati).toBe("II");
    const audit = db.select().from(schema.auditLog).all().at(-1)!;
    expect(audit).toMatchObject({ action: "create_document", patientId: "TEST-0001" });
    expect(audit.details).toMatchObject({ asaClass: "III", asaSuggested: "III" });
  });
});
