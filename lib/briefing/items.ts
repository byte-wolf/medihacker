import { CATEGORIES, type PlannedItem } from "@/lib/catalog/roles";
import { ageAt, type PatientRecord } from "@/lib/data/patients";
import { formatDate } from "@/lib/format";
import type { BriefingItem, Fact, Passage, RejectedFact } from "@/lib/types";
import { verifyFact, type RawFact, type VerifyContext } from "./verify";

export function verifyContext(patient: PatientRecord): VerifyContext {
  return {
    passages: new Map(patient.passages.map((p) => [p.id, p])),
    documents: new Map(patient.documents.map((d) => [d.id, d])),
  };
}

type RawItem = { key?: unknown; label?: unknown; status?: unknown; note?: unknown; facts?: unknown };

/**
 * Turn the model's JSON into briefing items, keeping only verified facts.
 * Items the model skipped are reported as unverified rather than silently missing.
 */
export function itemsFromModel(
  raw: { items?: unknown },
  planned: PlannedItem[],
  ctx: VerifyContext,
  sectionTitle: string,
): { items: BriefingItem[]; rejected: RejectedFact[] } {
  const rawItems = Array.isArray(raw.items) ? (raw.items as RawItem[]) : [];
  const rejected: RejectedFact[] = [];
  const items: BriefingItem[] = [];
  const plan = planned.length
    ? planned
    : rawItems.map((r, i) => ({ key: String(r.key ?? `answer_${i + 1}`), label: String(r.label ?? "Answer"), guidance: "" }));

  for (const p of plan) {
    const r = rawItems.find((x) => x.key === p.key);
    const label = planned.length ? p.label : typeof r?.label === "string" ? r.label : p.label;
    if (!r) {
      items.push({ key: p.key, label, status: "unverified", facts: [], note: "No answer was returned for this item. Check the source documents." });
      continue;
    }
    const facts: Fact[] = [];
    for (const f of Array.isArray(r.facts) ? (r.facts as RawFact[]) : []) {
      const v = verifyFact(f, ctx);
      if (v.ok) facts.push(v.fact);
      else rejected.push({ section: sectionTitle, item: p.key, statement: String(f?.statement ?? ""), reason: v.reason });
    }
    const note = typeof r.note === "string" && r.note.trim() ? r.note.trim() : undefined;
    if (facts.length) items.push({ key: p.key, label, status: "documented", facts });
    else if (r.status === "not_documented")
      items.push({ key: p.key, label, status: "not_documented", facts: [], note: note ?? "Not documented in any of the documents." });
    else
      items.push({
        key: p.key,
        label,
        status: "unverified",
        facts: [],
        note: "An answer was found but could not be verified against the source text, so it is not shown. Check the source documents.",
      });
  }
  return { items, rejected };
}

/** Age and sex are calculated in code from the date of birth in the latest document. */
export function demographicsItem(patient: PatientRecord): BriefingItem {
  const latest = patient.documents.at(-1);
  const [y, m, d] = patient.dateOfBirth.split("-");
  const dobGerman = `${d}.${m}.${y}`;
  const dobPassage =
    [...patient.passages].reverse().find((p) => p.docId === latest?.id && p.text.includes(dobGerman)) ??
    [...patient.passages].reverse().find((p) => p.text.includes(dobGerman));
  const age = ageAt(patient.dateOfBirth, patient.latestDocumentDate);
  const sex = patient.sex === "female" ? "female" : patient.sex === "male" ? "male" : patient.sex;
  if (!dobPassage) {
    return { key: "demographics", label: CATEGORIES.demographics.label, status: "not_documented", facts: [], note: "Date of birth not found in the documents." };
  }
  return {
    key: "demographics",
    label: CATEGORIES.demographics.label,
    status: "documented",
    facts: [
      {
        statement: `${age} years old at the latest document (${formatDate(patient.latestDocumentDate)}), ${sex}; born ${formatDate(patient.dateOfBirth)}.`,
        kind: "calculated",
        quotes: [{ passageId: dobPassage.id, text: dobGerman }],
      },
    ],
  };
}

/**
 * Fallback without a model: show the most recent matching source passages
 * (German, untranslated) for each item. Grounded, but not summarised.
 */
export function retrievalItems(patient: PatientRecord, planned: PlannedItem[]): BriefingItem[] {
  const docDate = new Map(patient.documents.map((d) => [d.id, d.date]));
  return planned.map((item) => {
    const cat = CATEGORIES[item.key];
    if (!cat) {
      return { key: item.key, label: item.label, status: "unverified" as const, facts: [], note: "Needs the AI model; not available." };
    }
    const seen = new Set<string>();
    const matches = patient.passages
      .filter((p: Passage) => p.kind !== "heading" && cat.terms.test(p.text))
      .sort((a, b) => (docDate.get(b.docId) ?? "").localeCompare(docDate.get(a.docId) ?? ""))
      .filter((p) => {
        const k = p.text.replace(/\s+/g, " ").toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 3);
    if (!matches.length) {
      return { key: item.key, label: item.label, status: "not_documented" as const, facts: [], note: "No matching passage found (keyword search)." };
    }
    return {
      key: item.key,
      label: item.label,
      status: "documented" as const,
      facts: matches.map((p) => ({ statement: p.text.replace(/\s*\n\s*/g, " "), kind: "documented" as const, quotes: [{ passageId: p.id, text: p.text }] })),
    };
  });
}
