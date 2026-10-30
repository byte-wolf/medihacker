import { CATEGORIES, deterministicPlan, type PlannedItem, type PlannedSection } from "@/lib/catalog/roles";
import type { PatientRecord } from "@/lib/data/patients";
import { listContradictions, ensureContradictions } from "@/lib/contradictions/store";
import { cachedComplete } from "@/lib/llm/cache";
import { LlmUnavailableError, parseJsonObject } from "@/lib/llm/provider";
import { briefingPrompt } from "@/lib/llm/prompts";
import type { BriefingSection, BriefingStreamEvent, Contradiction } from "@/lib/types";
import { demographicsItem, itemsFromModel, retrievalItems, verifyContext } from "./items";

export type SituationInput = { title: string; description: string } | null;

const ITEM_CONTRADICTION_CATEGORIES: Record<string, string[]> = {
  weight_trend: ["weight", "bmi"],
  vascular_findings: ["laterality", "carotid-stenosis"],
  prior_events: ["laterality", "carotid-stenosis"],
  tumour_imaging: ["laterality", "breast-lesion"],
  tumour_histology: ["laterality", "breast-lesion"],
  planned_procedure: ["dates"],
  followups_recommended: ["dates"],
};

function attachContradictions(section: BriefingSection, all: Contradiction[], relevant: Set<string>) {
  for (const item of section.items) {
    const cats = ITEM_CONTRADICTION_CATEGORIES[item.key] ?? [];
    for (const c of all) if (c.categories.some((x) => cats.includes(x))) relevant.add(c.id);
    for (const fact of item.facts) {
      const ids = all.filter((c) => fact.quotes.some((q) => c.passageIds.includes(q.passageId))).map((c) => c.id);
      if (ids.length) {
        fact.contradictionIds = ids;
        ids.forEach((id) => relevant.add(id));
      }
    }
  }
}

/** Send the sources once, then verify and emit every section using the same response. */
export async function buildBriefing(
  patient: PatientRecord,
  roles: string[],
  situation: SituationInput,
  emit: (e: BriefingStreamEvent) => void,
): Promise<{ sections: BriefingSection[]; ms: number; fallback: boolean }> {
  const started = Date.now();
  ensureContradictions(patient);
  const plan = deterministicPlan(roles, situation ? `${situation.title} ${situation.description}` : "");
  const emitPlan = (parts: PlannedSection[]) => emit({ type: "plan", sections: parts.map((s) => ({ id: s.id, title: s.title, items: s.items.map((i) => ({ key: i.key, label: i.label })) })) });
  emitPlan(plan);
  const contradictions = listContradictions(patient.id);
  emit({ type: "contradictions", relevant: [], all: contradictions });
  const relevant = new Set<string>();
  const sections: BriefingSection[] = [];
  const ctx = verifyContext(patient);
  const llmItems = plan.flatMap((s) => s.items).filter((i) => i.key !== "demographics");
  let raw: { items?: unknown; customItems?: unknown } = {};
  let fallback = false;
  let cached = true;
  if (llmItems.length) {
    try {
      const { system, user } = briefingPrompt({ patient, roles, situation, sectionTitle: "Complete briefing", items: llmItems });
      const result = await cachedComplete({
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        json: true, tag: "extract:briefing", maxTokens: 6500,
      });
      raw = parseJsonObject(result.text);
      cached = result.cached;
    } catch (err) {
      if (!(err instanceof LlmUnavailableError)) throw err;
      fallback = true;
      cached = false;
    }
  }
  // Novel situations can add questions in the same request, without a planning call.
  if (!fallback && situation && Array.isArray(raw.customItems)) {
    const known = new Set(plan.flatMap((s) => s.items.map((i) => i.key)));
    const extra: PlannedItem[] = [];
    const answers: Record<string, unknown>[] = [];
    for (const item of raw.customItems) {
      if (!item || typeof item !== "object" || typeof item.key !== "string" || typeof item.label !== "string") continue;
      if (!item.key.startsWith("custom_") || known.has(item.key) || CATEGORIES[item.key]) continue;
      known.add(item.key);
      extra.push({ key: item.key, label: item.label, guidance: "" });
      answers.push(item);
      if (extra.length === 4) break;
    }
    if (extra.length) {
      const section = { id: "situation", title: "Situation-specific questions", items: extra };
      plan.push(section);
      raw.items = [...(Array.isArray(raw.items) ? raw.items : []), ...answers];
      emitPlan([section]);
    }
  }
  for (const s of plan) {
    const planned = s.items.filter((i) => i.key !== "demographics");
    const verified = !planned.length ? { items: [], rejected: [] } : fallback ? { items: retrievalItems(patient, planned), rejected: [] } : itemsFromModel(raw, planned, ctx, s.title);
    const section: BriefingSection = {
      id: s.id, title: s.title,
      items: s.items.map((i) => i.key === "demographics" ? demographicsItem(patient) : verified.items.find((a) => a.key === i.key)!).filter(Boolean),
    };
    attachContradictions(section, contradictions, relevant);
    sections.push(section);
    emit({ type: "section", section });
    if (verified.rejected.length) emit({ type: "debug", rejected: verified.rejected });
  }
  emit({ type: "contradictions", relevant: [...relevant], all: contradictions });
  const ms = Date.now() - started;
  emit({ type: "done", ms, cached, fallback });
  return { sections, ms, fallback };
}
