import crypto from "node:crypto";
import type { PatientRecord } from "@/lib/data/patients";
import { docKindLabel, formatDate } from "@/lib/format";
import type { Contradiction, Passage, SourceDocument } from "@/lib/types";

// Deterministic contradiction checks. They look for *kinds* of conflicts
// (BMI arithmetic, event dates, laterality, case numbers); nothing here is
// specific to one patient.

export function contradictionId(kind: string, passageIds: string[]): string {
  return (
    "c_" +
    crypto
      .createHash("sha1")
      .update(kind + "|" + [...passageIds].sort().join(","))
      .digest("hex")
      .slice(0, 10)
  );
}

function docName(doc: SourceDocument | undefined, fallback: string) {
  return doc ? `${docKindLabel(doc.title, doc.type)}, ${formatDate(doc.date)}` : fallback;
}

const num = (s: string) => Number(s.replace(",", "."));

function byDoc(passages: Passage[]): Map<string, Passage[]> {
  const m = new Map<string, Passage[]>();
  for (const p of passages) m.set(p.docId, [...(m.get(p.docId) ?? []), p]);
  return m;
}

/** BMI stated in a document that does not match height and weight in the same document. */
export function checkBmi(patient: PatientRecord): Contradiction[] {
  const out: Contradiction[] = [];
  for (const [docId, ps] of byDoc(patient.passages)) {
    const height = ps.find((p) => /\bGröße:\s*\d/i.test(p.text));
    const weight = ps.find((p) => /\bGewicht:\s*\d/i.test(p.text));
    const bmi = ps.find((p) => /\bBMI:\s*\d/i.test(p.text));
    if (!height || !weight || !bmi) continue;
    const hm = height.text.match(/Größe:\s*(\d+(?:[.,]\d+)?)\s*(cm|m)?/i)!;
    const h = num(hm[1]) / (hm[2]?.toLowerCase() === "m" || num(hm[1]) < 3 ? 1 : 100);
    const w = num(weight.text.match(/Gewicht:\s*(\d+(?:[.,]\d+)?)/i)![1]);
    const stated = num(bmi.text.match(/BMI:\s*(\d+(?:[.,]\d+)?)/i)![1]);
    const calc = w / (h * h);
    if (Math.abs(calc - stated) > 1) {
      const doc = patient.documents.find((d) => d.id === docId);
      out.push({
        id: contradictionId("bmi", [height.id, weight.id, bmi.id]),
        title: `BMI does not match height and weight (${docName(doc, docId)})`,
        explanation: `The same document states BMI ${stated}, but ${w} kg at ${Math.round(h * 100)} cm gives a BMI of ${calc.toFixed(1)}.`,
        severity: "medium",
        categories: ["weight", "bmi", "vitals"],
        passageIds: [height.id, weight.id, bmi.id],
        detectedBy: "rule",
      });
    }
  }
  return out;
}

type ParsedDate = { iso: string | null; raw: string };

function parseDates(text: string): ParsedDate[] {
  const out: ParsedDate[] = [];
  for (const m of text.matchAll(/\b(\d{1,2})[./](\d{1,2})[./](\d{2,6})\b/g)) {
    const [, d, mo, y] = m;
    const valid = y.length === 4 && Number(mo) >= 1 && Number(mo) <= 12 && Number(d) >= 1 && Number(d) <= 31;
    out.push({
      raw: m[0],
      iso: valid ? `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}` : null,
    });
  }
  return out;
}

const EVENTS = [
  {
    key: "admission",
    label: "admission",
    // "Aufnahme am 10/04/2016" or "... am 12.04.2016 ... aufgenommen"
    re: /(Aufnahme am\s+(\d{1,2}[./]\d{1,2}[./]\d{2,6}))|((?<!geb\.?\s)am\s+(\d{1,2}\.\d{1,2}\.\d{2,6})[^.]*\baufgenommen\b)/i,
  },
  {
    key: "discharge",
    label: "discharge",
    re: /(Entlassen am\s+(\d{1,2}[./]\d{1,2}[./]\d{2,6}))|((?<!geb\.?\s)am\s+(\d{1,2}\.\d{1,2}\.\d{2,6})[^.]*\bentlassen\b)/i,
  },
];

/** The same document gives different (or impossible) dates for its admission or discharge. */
export function checkEventDates(patient: PatientRecord): Contradiction[] {
  const out: Contradiction[] = [];
  for (const [docId, ps] of byDoc(patient.passages)) {
    for (const ev of EVENTS) {
      const mentions: { passage: Passage; date: ParsedDate }[] = [];
      for (const p of ps) {
        const m = p.text.match(ev.re);
        if (!m) continue;
        const raw = m[2] ?? m[4];
        const date = parseDates(raw)[0];
        if (date) mentions.push({ passage: p, date });
      }
      if (mentions.length < 2) continue;
      const distinct = new Set(mentions.map((m) => m.date.iso ?? `invalid:${m.date.raw}`));
      if (distinct.size < 2) continue;
      const doc = patient.documents.find((d) => d.id === docId);
      const invalid = mentions.find((m) => !m.date.iso);
      const ids = mentions.map((m) => m.passage.id);
      out.push({
        id: contradictionId(`date-${ev.key}`, ids),
        title: invalid
          ? `Impossible ${ev.label} date (${docName(doc, docId)})`
          : `Two different ${ev.label} dates (${docName(doc, docId)})`,
        explanation: `The ${ev.label} date is given as ${mentions.map((m) => `"${m.date.raw}"`).join(" and ")} in the same document.${invalid ? ` "${invalid.date.raw}" is not a valid date.` : ""}`,
        severity: invalid ? "low" : "medium",
        categories: ["dates", ev.key],
        passageIds: ids,
        detectedBy: "rule",
      });
    }
  }
  return out;
}

const LEFT = /\b(links|linke[nrms]?|li\.|sin\.|sinistra)(?=\W|$)/i;
const RIGHT = /\b(rechts|rechte[nrms]?|re\.|dext\.?|dextra)(?=\W|$)/i;
const NEGATION = /\b(keine?|ohne|kein Anhalt|unauffällig)\b/i;

const LATERAL_FINDINGS = [
  {
    key: "carotid-stenosis",
    label: "carotid artery stenosis",
    topic: /(carotis|karotis)/i,
    finding: /(stenose|einengung|sklerose)/i,
  },
  { key: "breast-lesion", label: "breast lesion", topic: /(brust|mamma)/i, finding: /(läsion|karzinom|knoten|tumor|\bca\b)/i },
  { key: "eye-symptoms", label: "eye symptoms", topic: /\bauge\b/i, finding: /(amaurosis|sehst|sehschw|sehverl|sehbeein)/i },
];

/** The same finding is reported on the left in one passage and on the right in another. */
export function checkLaterality(patient: PatientRecord): Contradiction[] {
  const out: Contradiction[] = [];
  for (const f of LATERAL_FINDINGS) {
    const left: Passage[] = [];
    const right: Passage[] = [];
    for (const p of patient.passages) {
      if (p.kind === "heading" || !f.topic.test(p.text) || !f.finding.test(p.text) || NEGATION.test(p.text)) continue;
      const l = LEFT.test(p.text);
      const r = RIGHT.test(p.text);
      if (l && !r) left.push(p);
      if (r && !l) right.push(p);
    }
    if (!left.length || !right.length) continue;
    const [minority, majority] = right.length <= left.length ? [right, left] : [left, right];
    const docs = new Set(minority.map((p) => p.docId));
    // Link every minority passage plus the opposing passages from the same documents and one from another document.
    const opposing = [
      ...majority.filter((p) => docs.has(p.docId)),
      ...majority.filter((p) => !docs.has(p.docId)).slice(0, 2),
    ];
    const ids = [...minority, ...opposing].map((p) => p.id);
    const minoritySide = minority === right ? "right" : "left";
    const majoritySide = minoritySide === "right" ? "left" : "right";
    out.push({
      id: contradictionId(`side-${f.key}`, ids),
      title: `Side of the ${f.label} differs (${majoritySide} vs ${minoritySide})`,
      explanation: `${majority.length} passages place the ${f.label} on the ${majoritySide}, but ${minority.length === 1 ? "one passage places it" : `${minority.length} passages place it`} on the ${minoritySide}.`,
      severity: "high",
      categories: ["laterality", f.key],
      passageIds: ids,
      detectedBy: "rule",
    });
  }
  return out;
}

/** The same case number appears on documents from hospital stays that are months apart. */
export function checkCaseNumbers(patient: PatientRecord): Contradiction[] {
  const byCase = new Map<string, { passage: Passage; date: string }[]>();
  for (const p of patient.passages) {
    const m = p.text.match(/^\s*(?:Fall|Fallzahl|Fall-ID)\s*:\s*(\d{6,})\s*$/i);
    if (!m) continue;
    const date = patient.documents.find((d) => d.id === p.docId)?.date ?? "";
    byCase.set(m[1], [...(byCase.get(m[1]) ?? []), { passage: p, date }]);
  }
  const out: Contradiction[] = [];
  for (const [caseNo, entries] of byCase) {
    if (entries.length < 2) continue;
    const times = entries.map((e) => Date.parse(e.date));
    const first = Math.min(...times);
    const late = entries.filter((e) => Date.parse(e.date) - first > 90 * 864e5);
    const early = entries.filter((e) => Date.parse(e.date) - first <= 90 * 864e5);
    if (!late.length || !early.length) continue;
    const [odd, normal] = late.length <= early.length ? [late, early] : [early, late];
    const ids = [...odd.map((e) => e.passage.id), normal[0].passage.id];
    // Another document from the odd document's stay with a different case number makes the conflict explicit.
    const sameStay = patient.passages.find((p) => {
      const m = p.text.match(/^\s*(?:Fall|Fallzahl|Fall-ID)\s*:\s*(\d{6,})\s*$/i);
      if (!m || m[1] === caseNo) return false;
      const d = patient.documents.find((x) => x.id === p.docId)?.date ?? "";
      return odd.some((o) => Math.abs(Date.parse(o.date) - Date.parse(d)) < 7 * 864e5);
    });
    if (sameStay) ids.push(sameStay.id);
    out.push({
      id: contradictionId("case-number", ids),
      title: `Case number ${caseNo} used for two different hospital stays`,
      explanation: `Case number ${caseNo} appears on documents from ${formatDate(normal[0].date.slice(0, 7))} and ${formatDate(odd[0].date.slice(0, 7))}${sameStay ? "; another document from the later stay has a different case number" : ""}.`,
      severity: "low",
      categories: ["administrative", "dates"],
      passageIds: ids,
      detectedBy: "rule",
    });
  }
  return out;
}

export function runContradictionRules(patient: PatientRecord): Contradiction[] {
  return [
    ...checkLaterality(patient),
    ...checkBmi(patient),
    ...checkEventDates(patient),
    ...checkCaseNumbers(patient),
  ];
}
