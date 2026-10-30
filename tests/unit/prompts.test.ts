import { beforeAll, describe, expect, it } from "vitest";
import { setupSyntheticPatient } from "../helpers/synthetic";

// Both prompts must spell out the full fact format, or the model invents field names
// and every fact arrives without a statement.
describe("prompt formats", () => {
  let prompts: typeof import("@/lib/llm/prompts");
  let patient: import("@/lib/data/patients").PatientRecord;
  beforeAll(async () => {
    setupSyntheticPatient();
    prompts = await import("@/lib/llm/prompts");
    patient = (await import("@/lib/data/patients")).getPatient("9999-0001")!;
  });

  it("chat and extraction prompts show the full fact shape", () => {
    const chat = prompts.chatPrompt({ patient, roles: ["Anaesthetist"], situation: null, history: [], question: "Allergies?" });
    const extraction = prompts.extractionPrompt({ patient, roles: ["Anaesthetist"], situation: null, sectionTitle: "Safety", items: [{ key: "allergies", label: "Allergies", guidance: "" }] });
    for (const system of [chat.system, extraction.system]) {
      expect(system).toContain('"statement"');
      expect(system).toContain('"quotes"');
      expect(system).toContain('"passageId"');
    }
  });
});
