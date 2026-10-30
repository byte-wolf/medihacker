import { beforeAll, describe, expect, it } from "vitest";
import { setupSyntheticPatient } from "../helpers/synthetic";
import { ageAt, getPatient, listPatientFolders, listPatients, passageMap } from "@/lib/data/patients";

beforeAll(() => {
  setupSyntheticPatient();
});

describe("listPatientFolders", () => {
  it("lists folders that contain a patient.json", () => {
    expect(listPatientFolders()).toEqual(["patient-9999-0001"]);
  });
});

describe("getPatient", () => {
  it("loads a patient by short id and by folder name", () => {
    const byId = getPatient("9999-0001");
    const byFolder = getPatient("patient-9999-0001");
    expect(byId).not.toBeNull();
    expect(byFolder).toBe(byId); // same memoised record
  });

  it("returns null for an unknown patient", () => {
    expect(getPatient("does-not-exist")).toBeNull();
  });

  it("exposes metadata, sorted documents, passages and a stable hash", () => {
    const p = getPatient("9999-0001")!;
    expect(p.id).toBe("9999-0001");
    expect(p.name).toBe("Test Patientin");
    expect(p.sex).toBe("female");
    expect(p.dateOfBirth).toBe("1950-02-01");

    expect(p.documents.map((d) => d.id)).toEqual(["900001", "900002"]);
    expect(p.documents[0].date).toBe("2020-03-20");
    expect(p.latestDocumentDate).toBe("2020-09-01");

    expect(p.passages.length).toBeGreaterThan(0);
    for (const pass of p.passages) {
      expect(pass.id).toMatch(/^\d+:p\d+$/);
      expect(p.documents.some((d) => d.id === pass.docId)).toBe(true);
    }

    expect(p.hash).toMatch(/^[0-9a-f]{16}$/);
    expect(getPatient("9999-0001")!.hash).toBe(p.hash);
  });

  it("decodes <BR> markup into readable document text", () => {
    const p = getPatient("9999-0001")!;
    expect(p.documents[0].text).toContain("Penicillin-Allergie (Exanthem)");
    expect(p.documents[0].text).not.toContain("<BR>");
  });
});

describe("listPatients", () => {
  it("returns summaries without the document texts", () => {
    const [p] = listPatients();
    expect(p).toEqual({
      id: "9999-0001",
      name: "Test Patientin",
      sex: "female",
      dateOfBirth: "1950-02-01",
      documentCount: 2,
      latestDocumentDate: "2020-09-01",
    });
  });
});

describe("passageMap", () => {
  it("indexes every passage by id", () => {
    const p = getPatient("9999-0001")!;
    const m = passageMap(p);
    expect(m.size).toBe(p.passages.length);
    expect(m.get(p.passages[0].id)).toBe(p.passages[0]);
  });
});

describe("ageAt", () => {
  it("computes whole years", () => {
    expect(ageAt("1950-02-01", "2020-09-01")).toBe(70);
  });
  it("has not had the birthday yet this year", () => {
    expect(ageAt("1950-02-01", "2020-01-31")).toBe(69);
  });
  it("counts the birthday itself", () => {
    expect(ageAt("1950-02-01", "2020-02-01")).toBe(70);
  });
});

describe("missing data directory", () => {
  it("returns empty results instead of throwing", () => {
    const prev = process.env.PATIENT_DATA_DIR;
    process.env.PATIENT_DATA_DIR = "/nonexistent/path/for/tests";
    try {
      expect(listPatientFolders()).toEqual([]);
      expect(listPatients()).toEqual([]);
      // Not cached yet, so the lookup actually touches the missing directory.
      expect(getPatient("8888-0001")).toBeNull();
    } finally {
      process.env.PATIENT_DATA_DIR = prev;
    }
  });
});
