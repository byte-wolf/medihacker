import { CATEGORIES, deterministicPlan, type PlannedItem, type PlannedSection } from "@/lib/catalog/roles";
import type { PatientRecord } from "@/lib/data/patients";
import { listContradictions, ensureContradictions } from "@/lib/contradictions/store";
import { cachedComplete } from "@/lib/llm/cache";
import { LlmUnavailableError, llmConfigured, parseJsonObject } from "@/lib/llm/provider";
import { extractionPrompt, planPrompt } from "@/lib/llm/prompts";
import type { BriefingItem, BriefingSection, BriefingStreamEvent, Contradiction } from "@/lib/types";
import { demographicsItem, itemsFromModel, retrievalItems, verifyContext, weightTrendItem } from "./items";

/** Items built by rules in code (always the same, no model needed). */
const RULE_ITEMS: Record<string, (p: PatientRecord) => BriefingItem | null> = {
  demographics: demographicsItem,
  weight_trend: weightTrendItem,
};

export type SituationInput = { title: string; description: string } | null;

/** Contradiction categories that matter for a briefing item. */
const ITEM_CONTRADICTION_CATEGORIES: Record<string, string[]> = {
  weight_trend: ["weight", "bmi"],
  vascular_findings: ["laterality", "carotid-stenosis"],
  prior_events: ["laterality", "carotid-stenosis"],
  tumour_imaging: ["laterality", "breast-lesion"],
  tumour_histology: ["laterality", "breast-lesion"],
  planned_procedure: ["dates"],
  followups_recommended: ["dates"],
};

/** Situation-specific items from the model (cached), merged into the regular briefing sections. */
async function customItems(roles: string[], situation: SituationInput, plan: PlannedSection[]): Promise<PlannedItem[]> {
  if (!situation || !llmConfigured()) return [];
  const existing = plan.flatMap((s) => s.items.map((i) => i.label));
  const { system, user } = planPrompt({ roles, situation, existing });
  try {
    const { text } = await cachedComplete({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      json: true,
      fast: true,
      tag: "plan",
      maxTokens: 600,
    });
    const items = parseJsonObject<{ items?: PlannedItem[] }>(text).items ?? [];
    return items
      .filter((i) => typeof i?.key === "string" && typeof i?.label === "string")
      .slice(0, 4)
      .map((i) => ({ key: i.key.startsWith("custom_") ? i.key : `custom_${i.key}`, label: i.label, guidance: String(i.guidance ?? "") }));
  } catch (err) {
    console.error("[briefing] planning failed:", err);
    return [];
  }
}

async function extractSection(
  patient: PatientRecord,
  roles: string[],
  situation: SituationInput,
  section: PlannedSection,
): Promise<{ section: BriefingSection; rejected: BriefingStreamEvent & { type: "debug" }; cached: boolean; fallback: boolean }> {
  const ctx = verifyContext(patient);
  // Rule items fall back to the model when the rule finds nothing (e.g. weights written differently).
  const fixed = new Map<string, BriefingItem>();
  for (const i of section.items) {
    const item = RULE_ITEMS[i.key]?.(patient);
    if (item) fixed.set(i.key, item);
  }
  const llmItems = section.items.filter((i) => !fixed.has(i.key));
  if (!llmItems.length) {
    return { section: { id: section.id, title: section.title, items: [...fixed.values()] }, rejected: { type: "debug", rejected: [] }, cached: true, fallback: false };
  }
  try {
    // At most two items per call, all in parallel: short answers keep every call fast.
    const chunks = Array.from({ length: Math.ceil(llmItems.length / 2) }, (_, i) => llmItems.slice(i * 2, i * 2 + 2));
    const results = await Promise.all(
      chunks.map(async (chunk) => {
        const { system, user } = extractionPrompt({ patient, roles, situation, sectionTitle: section.title, items: chunk });
        const { text, cached } = await cachedComplete({
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          json: true,
          tag: `extract:${section.id}`,
          maxTokens: 3000,
        });
        return { ...itemsFromModel(parseJsonObject(text), chunk, ctx, section.title), cached };
      }),
    );
    const items = results.flatMap((r) => r.items);
    const rejected = results.flatMap((r) => r.rejected);
    const cached = results.every((r) => r.cached);
    const ordered = section.items.map((p) => fixed.get(p.key) ?? items.find((i) => i.key === p.key)!).filter(Boolean);
    return { section: { id: section.id, title: section.title, items: ordered }, rejected: { type: "debug", rejected }, cached, fallback: false };
  } catch (err) {
    // No model, or the model failed (quota, outage, timeout): show grounded keyword matches instead of an empty section.
    if (!(err instanceof LlmUnavailableError)) console.error(`[briefing] section ${section.id} fell back to keyword search:`, err instanceof Error ? err.message.slice(0, 200) : err);
    const items = retrievalItems(patient, llmItems);
    const ordered = section.items.map((p) => fixed.get(p.key) ?? items.find((i) => i.key === p.key)!).filter(Boolean);
    return { section: { id: section.id, title: section.title, items: ordered }, rejected: { type: "debug", rejected: [] }, cached: false, fallback: true };
  }
}

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

/**
 * Build the role- and situation-specific briefing. Sections are extracted in
 * parallel and emitted as soon as each is verified.
 */
export async function buildBriefing(
  patient: PatientRecord,
  roles: string[],
  situation: SituationInput,
  emit: (e: BriefingStreamEvent) => void,
): Promise<{ sections: BriefingSection[]; ms: number; fallback: boolean }> {
  const started = Date.now();
  ensureContradictions(patient);
  const plan = deterministicPlan(roles, situation ? `${situation.title} ${situation.description}` : "");
  emit({ type: "plan", sections: plan.map((s) => ({ id: s.id, title: s.title, items: s.items.map((i) => ({ key: i.key, label: i.label })) })) });

  const contradictions = listContradictions(patient.id);
  // Precomputed, so the clinician sees them immediately; relevance is filled in at the end.
  emit({ type: "contradictions", relevant: [], all: contradictions });
  const relevant = new Set<string>();
  const sections: BriefingSection[] = [];
  let fallback = false;
  let allCached = true;

  const runOne = async (s: PlannedSection): Promise<BriefingSection | null> => {
    try {
      const r = await extractSection(patient, roles, situation, s);
      attachContradictions(r.section, contradictions, relevant);
      fallback ||= r.fallback;
      allCached &&= r.cached;
      if (r.rejected.rejected.length) emit(r.rejected);
      return r.section;
    } catch (err) {
      console.error(`[briefing] section ${s.id} failed:`, err);
      allCached = false;
      emit({ type: "error", sectionId: s.id, message: "This section could not be loaded. Please retry." });
      return null;
    }
  };
  const publish = (section: BriefingSection | null) => {
    if (!section) return;
    const i = sections.findIndex((x) => x.id === section.id);
    if (i >= 0) sections[i] = section;
    else sections.push(section);
    emit({ type: "section", section });
  };
  const jobs = plan.map((s) => runOne(s).then((section) => (publish(section), section)));

  // Situation-specific items are planned while the standard sections are already extracting,
  // then appended to the last regular section (no separate "questions" section to read).
  const customJob = customItems(roles, situation, plan).then(async (items) => {
    const known = new Set(plan.flatMap((s) => s.items.map((i) => i.key)));
    const extra = items.filter((i) => !known.has(i.key) && !CATEGORIES[i.key]);
    const target = plan.at(-1);
    if (!extra.length || !target) return;
    const [extraSection, base] = await Promise.all([runOne({ ...target, items: extra }), jobs[plan.length - 1]]);
    if (!extraSection?.items.length) return;
    publish({ ...(base ?? { id: target.id, title: target.title, items: [] }), items: [...(base?.items ?? []), ...extraSection.items] });
  });

  await Promise.all([...jobs, customJob]);
  emit({ type: "contradictions", relevant: [...relevant], all: contradictions });
  const ms = Date.now() - started;
  emit({ type: "done", ms, cached: allCached, fallback });
  return { sections, ms, fallback };
}
