import { beforeAll, describe, expect, it, vi } from "vitest";
import { setupSyntheticPatient } from "../helpers/synthetic";
import { MockProvider, setProvider, type CompleteOptions } from "@/lib/llm/provider";
import { getPatient } from "@/lib/data/patients";
import { ensureTranslations, translationsForDocument } from "@/lib/data/translations";

beforeAll(() => setupSyntheticPatient());
describe("on-demand translation", () => {
  it("translates only selected passages, reuses saved translations, and coalesces repeated requests", async () => {
    const patient = getPatient("9999-0001")!;
    const passage = patient.passages.find((p) => p.text.includes("Penicillin-Allergie"))!;
    const handler = vi.fn(async (opts: CompleteOptions) => {
      const source = JSON.parse(opts.messages[1].content);
      expect(Object.keys(source)).toEqual([passage.id]);
      await Promise.resolve();
      return JSON.stringify({ translations: { [passage.id]: "Penicillin allergy (rash)" } });
    });
    setProvider(new MockProvider(handler));
    await Promise.all([ensureTranslations(patient, [passage.id]), ensureTranslations(patient, [passage.id])]);
    await ensureTranslations(patient, [passage.id]);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(translationsForDocument(patient, passage.docId)[passage.id]).toBe("Penicillin allergy (rash)");
    setProvider(null);
  });
});
