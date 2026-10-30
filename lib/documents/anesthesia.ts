import { normalizeForMatch } from "@/lib/data/parse";
import type { Score, StructuredData, StructuredNode } from "@/lib/data/structured";

// Preoperative Anesthesia Checklist: pre-fill from the patient's structured
// data (no LLM), the rule-based ASA suggestion, and save-time validation.
// Pure functions only, so the form (client) and the API route share them.

export const ASA_CLASSES = ["I", "II", "III", "IV", "V", "VI"] as const;
export type AsaClass = (typeof ASA_CLASSES)[number];

export const DENTAL_OPTIONS = [
  "Own teeth, intact",
  "Loose or damaged teeth",
  "Crowns, bridges or implants",
  "Partial denture",
  "Full denture (upper)",
  "Full denture (lower)",
  "Edentulous",
] as const;

export const MALLAMPATI = ["I", "II", "III", "IV"] as const;

export type Origin = "record" | "manual";
/** passageIds: the passages in those documents that mention the value (for highlighting the source). */
type Sourced = { id: string; origin: Origin; date: string; docIds: string[]; passageIds: string[] };
export type AllergyEntry = Sourced & { text: string };
export type MedicationEntry = Sourced & { drug: string; dosage: string };
export type ConditionEntry = Sourced & { label: string; detail: string; status: "positive" | "statuspost" | "suspected"; icd: string[] };
export type SurgeryEntry = Sourced & { label: string };
export type RecordValue = { value: number; date: string; docIds: string[] };

export type Checklist = {
  /** One id per filled-in form; the server saves each form only once. Set by the client. */
  formId: string;
  identity: { patientId: string; name: string; dateOfBirth: string; sex: string; confirmed: boolean };
  allergies: { entries: AllergyEntry[]; confirmed: boolean };
  medication: MedicationEntry[];
  conditions: ConditionEntry[];
  surgeries: SurgeryEntry[];
  /** Explicit confirmations of C and D; any edit of a list resets its confirmation. */
  confirmations: { medication: boolean; diagnoses: boolean; history: boolean };
  exam: {
    dental: string[];
    dentalNotes: string;
    bpSystolic: string;
    bpDiastolic: string;
    temperature: string;
    mallampati: string;
    heightCm: string;
    weightKg: string;
    smoking: "" | "never" | "former" | "current";
    packYears: string;
    alcohol: "" | "none" | "occasional" | "regular" | "dependence";
    alcoholNotes: string;
  };
  asa: { finalClass: AsaClass | ""; emergency: boolean; note: string };
  /** Read-only values from the record that the ASA rules use. */
  record: {
    referenceDate: string;
    height?: RecordValue;
    weight?: RecordValue;
    bmi?: RecordValue;
    ejectionFraction?: RecordValue;
    hba1c?: RecordValue;
  };
};

export type PrefillInput = {
  patient: { id: string; name: string; dateOfBirth: string; sex: string };
  structured: StructuredData;
  /** Allergy lines from the documents' "Allergien" sections (as in the CAVE banner). */
  allergyPassages: { passageId: string; text: string }[];
  referenceDate: string;
  /** The patient's passages, to link each value to the lines that mention it. */
  passages?: { id: string; docId: string; text: string }[];
};

type Link = (nodes: StructuredNode[]) => string[];

/** Passages that mention the extracted value, searched only in the documents the value names. */
function linker(passages: PrefillInput["passages"]): Link {
  if (!passages?.length) return () => [];
  const byDoc = new Map<string, { id: string; norm: string }[]>();
  for (const p of passages) byDoc.set(p.docId, [...(byDoc.get(p.docId) ?? []), { id: p.id, norm: normalizeForMatch(p.text) }]);
  return (nodes) => {
    const ids = new Set<string>();
    for (const n of nodes)
      for (const docId of n.documentIds ?? []) {
        const inDoc = byDoc.get(docId) ?? [];
        for (const candidate of [n.text, n.name, n.drug, n.agent]) {
          const needle = normalizeForMatch(clean(candidate));
          if (needle.length < 3) continue;
          const hits = inDoc.filter((p) => p.norm.includes(needle));
          if (!hits.length) continue;
          hits.forEach((h) => ids.add(h.id));
          break;
        }
      }
    return [...ids];
  };
}

const num = (s: string | undefined) => {
  const n = Number(String(s ?? "").replace(",", ".").trim());
  return s !== undefined && String(s).trim() !== "" && Number.isFinite(n) ? n : null;
};

function latestScore(scores: Score[], name: RegExp): RecordValue | undefined {
  const s = scores.find((x) => name.test(x.name));
  const v = [...(s?.values ?? [])].sort((a, b) => b.date.value.localeCompare(a.date.value))[0];
  const value = num(v?.value);
  return v && value !== null ? { value, date: v.date.value, docIds: v.documentIds } : undefined;
}

/** Leaves (dated mentions) below a node. */
function mentions(node: StructuredNode): StructuredNode[] {
  return node.values?.length ? node.values.flatMap(mentions) : node.date ? [node] : [];
}

const newest = (nodes: StructuredNode[]) => [...nodes].sort((a, b) => (b.date?.value ?? "").localeCompare(a.date?.value ?? ""))[0];
const docIdsOf = (nodes: StructuredNode[]) => [...new Set(nodes.flatMap((n) => n.documentIds ?? []))];
const clean = (s: string | undefined) => (s ?? "").replace(/<\/?[a-z][^>]*>/gi, "").replace(/\s+/g, " ").trim();

function medicationFrom(tree: StructuredNode[], link: Link): MedicationEntry[] {
  // tree: ATC group → subgroup → active agent → mentions. One entry per agent, newest mention.
  const byDrug = new Map<string, { id: string; nodes: StructuredNode[] }>();
  for (const group of tree)
    for (const sub of group.values ?? [])
      for (const agent of sub.values ?? []) {
        const key = clean(agent.name);
        const prev = byDrug.get(key) ?? { id: agent.id ?? key, nodes: [] };
        byDrug.set(key, { ...prev, nodes: [...prev.nodes, ...mentions(agent)] });
      }
  return [...byDrug].map(([drug, { id, nodes }]) => {
    const n = newest(nodes);
    return {
      id,
      origin: "record" as const,
      drug,
      dosage: clean(n?.name ?? n?.text),
      date: n?.date?.value ?? "",
      docIds: docIdsOf(nodes),
      passageIds: link(nodes),
    };
  }).sort((a, b) => b.date.localeCompare(a.date) || a.drug.localeCompare(b.drug));
}

function conditionsFrom(tree: StructuredNode[], link: Link): ConditionEntry[] {
  // tree: chapter → ICD group → finding (with status) → mentions. One entry per ICD group.
  const out: ConditionEntry[] = [];
  for (const chapter of tree)
    for (const group of chapter.values ?? []) {
      const findings = (group.values ?? []).filter((f) => f.status && f.status !== "negative");
      if (!findings.length) continue;
      const confirmed = findings.filter((f) => f.status === "positive" || f.status === "statuspost");
      const used = confirmed.length ? confirmed : findings;
      const status = confirmed.some((f) => f.status === "positive") ? "positive" : confirmed.length ? "statuspost" : "suspected";
      const nodes = used.flatMap(mentions);
      const icd = [...new Set(used.filter((f) => f.code?.catalog === "ICD10" && f.code.value).map((f) => f.code!.value))];
      out.push({
        id: group.id ?? clean(group.name),
        origin: "record",
        label: clean(group.name),
        detail: [...new Set(nodes.map((n) => clean(n.text ?? n.name)))].slice(0, 3).join("; "),
        status,
        icd,
        date: newest(nodes)?.date?.value ?? "",
        docIds: docIdsOf(nodes),
        passageIds: link(nodes),
      });
    }
  return out;
}

function surgeriesFrom(tree: StructuredNode[], link: Link): SurgeryEntry[] {
  const out = new Map<string, SurgeryEntry>();
  for (const chapter of tree.filter((c) => /operation/i.test(c.name ?? "")))
    for (const group of chapter.values ?? [])
      for (const p of group.values ?? []) {
        if (p.status !== "positive" && p.status !== "statuspost") continue; // planned ("recommended") is not history
        const label = clean(p.name);
        const nodes = mentions(p);
        const prev = out.get(label);
        const docIds = [...new Set([...(prev?.docIds ?? []), ...docIdsOf(nodes)])];
        const date = [prev?.date ?? "", newest(nodes)?.date?.value ?? ""].sort().at(-1) ?? "";
        const passageIds = [...new Set([...(prev?.passageIds ?? []), ...link(nodes)])];
        out.set(label, { id: p.id ?? label, origin: "record", label, date, docIds, passageIds });
      }
  return [...out.values()];
}

function allergiesFrom(input: PrefillInput): AllergyEntry[] {
  const fromDocs: AllergyEntry[] = input.allergyPassages.map((p) => ({
    id: p.passageId,
    origin: "record",
    text: p.text,
    date: "",
    docIds: [p.passageId.split(":")[0]],
    passageIds: [p.passageId],
  }));
  // cave.json often only says "Arzneimittel-Allergie"; keep it when the documents name nothing more specific.
  const fromCave = fromDocs.length
    ? []
    : input.structured.adverseReactions.map((text, i) => ({ id: `cave-${i}`, origin: "record" as const, text, date: "", docIds: [], passageIds: [] }));
  return [...fromDocs, ...fromCave];
}

export function prefillAnesthesia(input: PrefillInput): Checklist {
  const { structured: s } = input;
  const link = linker(input.passages);
  const height = latestScore(s.scores, /^größe$/i);
  const weight = latestScore(s.scores, /^gewicht$/i);
  // Height comes in metres ("1,7"); a value above 3 is already in cm.
  const heightCm = height ? (height.value <= 3 ? Math.round(height.value * 100) : height.value) : null;
  return {
    formId: "",
    identity: { patientId: input.patient.id, name: input.patient.name, dateOfBirth: input.patient.dateOfBirth, sex: input.patient.sex, confirmed: false },
    allergies: { entries: allergiesFrom(input), confirmed: false },
    medication: medicationFrom(s.medication, link),
    conditions: conditionsFrom(s.diagnoses, link),
    surgeries: surgeriesFrom(s.procedures, link),
    confirmations: { medication: false, diagnoses: false, history: false },
    exam: {
      dental: [],
      dentalNotes: "",
      bpSystolic: "",
      bpDiastolic: "",
      temperature: "",
      mallampati: "",
      heightCm: heightCm !== null ? String(heightCm) : "",
      weightKg: weight ? String(weight.value) : "",
      smoking: "",
      packYears: "",
      alcohol: "",
      alcoholNotes: "",
    },
    asa: { finalClass: "", emergency: false, note: "" },
    record: {
      referenceDate: input.referenceDate,
      height,
      weight,
      bmi: latestScore(s.scores, /body-mass-index|^bmi$/i),
      ejectionFraction: latestScore(s.scores, /ejektionsfraktion|^ef$/i),
      hba1c: latestScore(s.scores, /hba1c/i),
    },
  };
}

export function bmiOf(heightCm: string, weightKg: string): number | null {
  const h = num(heightCm);
  const w = num(weightKg);
  if (!h || !w || h < 50 || h > 250 || w < 2 || w > 400) return null;
  return Math.round((w / (h / 100) ** 2) * 10) / 10;
}

// ---------------------------------------------------------------- ASA

export type AsaReason = { asaClass: AsaClass; text: string };
export type AsaResult =
  | { status: "incomplete"; missing: string[] }
  | { status: "complete"; asaClass: AsaClass; reasons: AsaReason[] };

/** Fields the ASA suggestion needs; the rest of the form does not change the class. */
export function asaMissing(c: Checklist): string[] {
  const e = c.exam;
  const missing: string[] = [];
  if (bmiOf(e.heightCm, e.weightKg) === null) missing.push("Height and weight");
  if (num(e.bpSystolic) === null || num(e.bpDiastolic) === null) missing.push("Blood pressure");
  if (!e.smoking) missing.push("Smoking history");
  if (!e.alcohol) missing.push("Alcohol history");
  return missing;
}

/** Whole months from a "YYYY-MM-xx" / ISO date to the reference date; null when unknown. */
function monthsBefore(date: string, reference: string): number | null {
  const a = date.match(/^(\d{4})-(\d{2})/);
  const b = reference.match(/^(\d{4})-(\d{2})/);
  if (!a || !b) return null;
  return (Number(b[1]) - Number(a[1])) * 12 + Number(b[2]) - Number(a[2]);
}

type Rule = { match: RegExp; exclude?: RegExp; asaClass: AsaClass; text: string; recentIs4?: boolean };

// Examples from the ASA Physical Status Classification (ASA, 2020).
const CONDITION_RULES: Rule[] = [
  { match: /hyperton|\bHTN\b|\bart\.? ?HT\b/i, exclude: /pulmonal/i, asaClass: "II", text: "Hypertension" },
  { match: /diabet|\bDM ?I|NIDDM|diab\.? ?mell/i, asaClass: "II", text: "Diabetes mellitus" },
  { match: /asthma/i, asaClass: "II", text: "Asthma (mild lung disease)" },
  { match: /COPD|chronisch.{0,3} obstruktiv/i, asaClass: "III", text: "COPD" },
  { match: /\bKHK\b|koronare herz|ischämische herzkrankheit|coronary/i, asaClass: "III", text: "Coronary artery disease" },
  { match: /stent/i, asaClass: "III", text: "Coronary stent" },
  { match: /schrittmacher|pacemaker/i, asaClass: "III", text: "Implanted pacemaker" },
  { match: /dialyse|terminale niereninsuff/i, asaClass: "III", text: "End-stage renal disease / dialysis" },
  { match: /leberzirrhose|hepatitis/i, asaClass: "III", text: "Liver disease" },
  {
    match: /\bTIA\b|transitorisch.{0,3} ischäm|apoplex|schlaganfall|hirninfarkt|\binsult|amaurosis fugax/i,
    asaClass: "III",
    text: "History of TIA or stroke",
    recentIs4: true,
  },
  { match: /myokardinfarkt|herzinfarkt|\bN?STEMI\b/i, asaClass: "III", text: "History of myocardial infarction", recentIs4: true },
];

const rank = (c: AsaClass) => ASA_CLASSES.indexOf(c);

/** Rule-based ASA class from the entered data. The anaesthetist confirms or changes it. */
export function suggestAsa(c: Checklist): AsaResult {
  const missing = asaMissing(c);
  if (missing.length) return { status: "incomplete", missing };
  const e = c.exam;
  const reasons: AsaReason[] = [];

  const bmi = bmiOf(e.heightCm, e.weightKg)!;
  if (bmi >= 40) reasons.push({ asaClass: "III", text: `Morbid obesity (BMI ${bmi})` });
  else if (bmi >= 30) reasons.push({ asaClass: "II", text: `Obesity (BMI ${bmi})` });

  if (e.smoking === "current") reasons.push({ asaClass: "II", text: "Current smoker" });
  if (e.alcohol === "occasional" || e.alcohol === "regular") reasons.push({ asaClass: "II", text: "Alcohol use (social drinker)" });
  if (e.alcohol === "dependence") reasons.push({ asaClass: "III", text: "Alcohol dependence or abuse" });

  const counted = c.conditions.filter((x) => x.status !== "suspected");
  const sys = num(e.bpSystolic)!;
  const dia = num(e.bpDiastolic)!;
  for (const rule of CONDITION_RULES) {
    // Diagnosis name only: details mention findings such as "Fundus hypertonicus" that are not the disease.
    const hits = counted.filter((x) => rule.match.test(x.label) && !rule.exclude?.test(x.label));
    if (!hits.length) continue;
    const latest = hits.map((h) => h.date).sort().at(-1) ?? "";
    const months = monthsBefore(latest, c.record.referenceDate);
    let asaClass = rule.asaClass;
    let text = rule.text;
    if (rule.recentIs4 && months !== null && months < 3) {
      asaClass = "IV";
      text = `${rule.text}, less than 3 months ago`;
    } else if (rule.recentIs4) {
      text = `${rule.text}, more than 3 months ago`;
    }
    if (rule.text === "Hypertension" && (sys >= 180 || dia >= 110)) {
      asaClass = "III";
      text = `Hypertension, poorly controlled (${sys}/${dia} mmHg today)`;
    }
    if (rule.text === "Diabetes mellitus" && c.record.hba1c && c.record.hba1c.value > 8) {
      asaClass = "III";
      text = `Diabetes mellitus, poorly controlled (HbA1c ${c.record.hba1c.value} %)`;
    }
    reasons.push({ asaClass, text: `${text}: ${hits.map((h) => h.label).join("; ")}` });
  }

  const ef = c.record.ejectionFraction;
  if (ef && ef.value < 25) reasons.push({ asaClass: "IV", text: `Severely reduced ejection fraction (${ef.value} %)` });
  else if (ef && ef.value < 40) reasons.push({ asaClass: "III", text: `Reduced ejection fraction (${ef.value} %)` });

  if (!reasons.length) return { status: "complete", asaClass: "I", reasons: [{ asaClass: "I", text: "No systemic disease in the entered data" }] };
  reasons.sort((a, b) => rank(b.asaClass) - rank(a.asaClass));
  return { status: "complete", asaClass: reasons[0].asaClass, reasons };
}

/** Diagnoses that still need an ICD-10 code before they can be confirmed. */
export const uncodedDiagnoses = (c: Checklist) => c.conditions.filter((x) => !x.icd.length);

// ---------------------------------------------------------------- save

/** Reasons the checklist cannot be saved yet; empty when it can. */
export function saveBlockers(c: Checklist): string[] {
  const out: string[] = [];
  if (!c.identity.confirmed) out.push("Confirm the patient's identity (A).");
  if (!c.allergies.confirmed) out.push("Confirm the allergies (B).");
  if (!c.confirmations.medication) out.push("Confirm the current medication (C).");
  if (!c.confirmations.diagnoses) out.push("Confirm the diagnoses and ICD codes (D).");
  else if (uncodedDiagnoses(c).length) out.push("Every diagnosis needs an ICD-10 code (D).");
  if (!c.confirmations.history) out.push("Confirm the medical history (D).");
  const asa = suggestAsa(c);
  if (asa.status === "incomplete") out.push(`Complete the fields the ASA score needs: ${asa.missing.join(", ")} (E).`);
  if (!c.asa.finalClass) out.push("Confirm the ASA class (F).");
  return out;
}
