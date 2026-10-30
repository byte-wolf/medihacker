import { CATEGORIES, compactPlan, deterministicPlan, MAX_BRIEFING_ITEMS, restrictPlan, type PlannedItem, type PlannedSection } from "@/lib/catalog/roles";
import type { PatientRecord } from "@/lib/data/patients";
import { listContradictions, ensureContradictions } from "@/lib/contradictions/store";
import { cachedComplete } from "@/lib/llm/cache";
import { LlmUnavailableError, llmConfigured, parseJsonObject } from "@/lib/llm/provider";
import { sumTokens, TOKEN_LIMITS, withTokenLog } from "@/lib/llm/tokens";
import { extractionPrompt, selectionPrompt } from "@/lib/llm/prompts";
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

/**
 * The model picks the few items this role needs for this situation (cached, fast model), plus up
 * to two situation-specific items the catalog lacks. Without a model, or if its answer is unusable,
 * a rule picks them.
 */
async function selectPlan(roles: string[], situation: SituationInput): Promise<PlannedSection[]> {
  const situationText = situation ? `${situation.title} ${situation.description}` : "";
  const fallback = compactPlan(roles, situationText);
  if (!situation || !llmConfigured()) return fallback;
  const catalog = Object.values(CATEGORIES).map((c) => ({ key: c.key, label: c.label }));
  const { system, user } = selectionPrompt({ roles, situation, catalog, max: MAX_BRIEFING_ITEMS });
  try {
    const { text } = await cachedComplete({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      json: true,
      fast: true,
      tag: "select",
      maxTokens: TOKEN_LIMITS.select,
    });
    const raw = parseJsonObject<{ keys?: unknown; custom?: unknown }>(text);
    const picked = (Array.isArray(raw.keys) ? raw.keys : []).filter((k): k is string => typeof k === "string" && !!CATEGORIES[k]);
    if (picked.length < 3) return fallback;
    const custom: PlannedItem[] = (Array.isArray(raw.custom) ? (raw.custom as PlannedItem[]) : [])
      .filter((i) => typeof i?.key === "string" && typeof i?.label === "string")
      .slice(0, 2)
      .map((i) => ({ key: i.key.startsWith("custom_") ? i.key : `custom_${i.key}`, label: i.label, guidance: String(i.guidance ?? "") }));
    const keys = [...new Set(picked.includes("allergies") ? picked : ["allergies", ...picked])].slice(0, MAX_BRIEFING_ITEMS - custom.length);
    const plan = restrictPlan(deterministicPlan(roles, situationText), keys);
    if (custom.length) plan.push({ id: "situation", title: "For this situation", items: custom });
    return plan;
  } catch (err) {
    if (!(err instanceof LlmUnavailableError)) console.error("[briefing] item selection failed:", err instanceof Error ? err.message.slice(0, 200) : err);
    return fallback;
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
          maxTokens: TOKEN_LIMITS.extract,
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
  const { result, calls } = await withTokenLog(() => runBriefing(patient, roles, situation, emit));
  const tokens = sumTokens(calls);
  emit({ type: "tokens", calls, total: tokens.total });
  console.log(`[tokens] briefing total ${tokens.prompt} in + ${tokens.completion} out = ${tokens.total} over ${calls.filter((c) => !c.cached).length} model calls (${calls.filter((c) => c.cached).length} cached)`);
  const ms = Date.now() - started;
  emit({ type: "done", ms, cached: result.allCached, fallback: result.fallback });
  return { sections: result.sections, ms, fallback: result.fallback };
}

async function runBriefing(patient: PatientRecord, roles: string[], situation: SituationInput, emit: (e: BriefingStreamEvent) => void) {
  ensureContradictions(patient);
  const plan = await selectPlan(roles, situation);
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
  await Promise.all(plan.map((s) => runOne(s).then(publish)));
  emit({ type: "contradictions", relevant: [...relevant], all: contradictions });
  return { sections, allCached, fallback };
}
