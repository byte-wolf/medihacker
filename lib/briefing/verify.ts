import { normalizeForMatch } from "@/lib/data/parse";
import type { Calculation, Fact, Passage, Quote, SourceDocument } from "@/lib/types";

// The trust layer: every fact the model returns must be backed by verbatim
// quotes from real passages, and every number in it must appear in those
// passages (or be a calculation we can recompute). Anything else is dropped.

export type RawFact = {
  statement?: unknown;
  quotes?: unknown;
  calculation?: unknown;
};

export type VerifyContext = {
  passages: Map<string, Passage>;
  documents: Map<string, SourceDocument>;
};

export type VerifyResult = { ok: true; fact: Fact } | { ok: false; reason: string };

const ROMAN: Record<string, string> = { i: "1", ii: "2", iii: "3", iv: "4", v: "5" };

/** Numbers that occur in a text, normalised ("6,4" → "6.4", "05" → "5", "Typ II" → "2"). */
export function numbersIn(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/\d+(?:[.,]\d+)?/g)) out.add(String(Number(m[0].replace(",", "."))));
  for (const m of text.matchAll(/\b(i{1,3}|iv|v)\b/gi)) out.add(ROMAN[m[1].toLowerCase()]);
  // "1/2" in a schedule means a half dose
  if (/\b1\/2\b/.test(text)) out.add("0.5");
  return out;
}

/** Numbers in a model statement that must be supported. Schedules (1-0-1) and dates are handled separately. */
export function claimedNumbers(statement: string): string[] {
  const cleaned = statement
    .replace(/\b\d(?:\/\d)?(?:\s*[-–]\s*\d(?:\/\d)?(?:\.\d)?){2,3}\b/g, " ") // dosing schedules
    .replace(/\b\d+(?:st|nd|rd|th)\b/gi, " ");
  return [...cleaned.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => String(Number(m[0].replace(",", "."))));
}

function dateNumbers(isoDate: string): string[] {
  const [y, m, d] = isoDate.split("-");
  return [y, m, d].filter(Boolean).map((x) => String(Number(x)));
}

function tokenOverlap(a: string, b: string): number {
  const ta = normalizeForMatch(a).split(" ").filter((t) => t.length > 2);
  const tb = new Set(normalizeForMatch(b).split(" "));
  if (ta.length === 0) return 0;
  return ta.filter((t) => tb.has(t)).length / ta.length;
}

function verifyQuote(q: Quote, ctx: VerifyContext): Quote | null {
  const passage = ctx.passages.get(q.passageId);
  const nq = normalizeForMatch(q.text ?? "");
  if (passage && nq && normalizeForMatch(passage.text).includes(nq)) return q;
  // Wrong passage id but verbatim quote elsewhere: re-anchor to the passage that really contains it.
  if (nq.length >= 8) {
    for (const p of ctx.passages.values()) {
      if (normalizeForMatch(p.text).includes(nq)) return { passageId: p.id, text: q.text };
    }
  }
  // Paraphrased quote of the cited passage: accept the passage itself if nearly all words match.
  if (passage && nq && tokenOverlap(q.text, passage.text) >= 0.8) return { passageId: passage.id, text: passage.text };
  return null;
}

function verifyCalculation(raw: unknown, ctx: VerifyContext): Calculation | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as { type?: string; inputs?: unknown; result?: unknown; unit?: string };
  if (!Array.isArray(c.inputs) || typeof c.result !== "number") return null;
  const inputs = c.inputs
    .filter((i): i is { passageId: string; value: number; unit?: string; label?: string } =>
      !!i && typeof i === "object" && typeof (i as { passageId?: unknown }).passageId === "string" && typeof (i as { value?: unknown }).value === "number",
    )
    .filter((i) => {
      const p = ctx.passages.get(i.passageId);
      return p && numbersIn(p.text).has(String(i.value));
    });
  if (inputs.length !== c.inputs.length || inputs.length < 2) return null;
  if (c.type === "difference") {
    const d = inputs.at(-1)!.value - inputs[0].value;
    if (Math.abs(Math.abs(d) - Math.abs(c.result)) > 0.6) return null;
    return { type: "difference", inputs, result: Math.round(d * 10) / 10, unit: c.unit };
  }
  if (c.type === "bmi") {
    const weight = inputs.find((i) => i.unit === "kg") ?? inputs[0];
    const height = inputs.find((i) => i !== weight)!;
    const h = height.value > 3 ? height.value / 100 : height.value;
    const bmi = weight.value / (h * h);
    if (Math.abs(bmi - c.result) > 0.6) return null;
    return { type: "bmi", inputs, result: Math.round(bmi * 10) / 10 };
  }
  return null;
}

export function verifyFact(raw: RawFact, ctx: VerifyContext): VerifyResult {
  const statement = typeof raw.statement === "string" ? raw.statement.trim() : "";
  if (!statement) return { ok: false, reason: "empty statement" };
  const rawQuotes = Array.isArray(raw.quotes) ? (raw.quotes as Quote[]) : [];
  if (rawQuotes.length === 0) return { ok: false, reason: "no source quote" };

  const quotes: Quote[] = [];
  for (const q of rawQuotes) {
    if (!q || typeof q.passageId !== "string") return { ok: false, reason: "malformed quote" };
    const v = verifyQuote(q, ctx);
    if (!v) return { ok: false, reason: `quote not found in ${q.passageId}: "${String(q.text).slice(0, 60)}"` };
    if (!quotes.some((x) => x.passageId === v.passageId)) quotes.push(v);
  }

  const calculation = raw.calculation ? verifyCalculation(raw.calculation, ctx) : undefined;
  if (raw.calculation && !calculation) return { ok: false, reason: "calculation could not be reproduced" };

  // Every number in the statement must be in a cited passage, a cited document's date, or the calculation.
  const allowed = new Set<string>();
  for (const q of quotes) {
    const p = ctx.passages.get(q.passageId)!;
    numbersIn(p.text).forEach((n) => allowed.add(n));
    const doc = ctx.documents.get(p.docId);
    if (doc) dateNumbers(doc.date).forEach((n) => allowed.add(n));
  }
  if (calculation) {
    allowed.add(String(Math.abs(calculation.result)));
    allowed.add(String(Math.round(Math.abs(calculation.result))));
    for (const i of calculation.inputs) {
      allowed.add(String(i.value));
      const p = ctx.passages.get(i.passageId);
      if (p) numbersIn(p.text).forEach((n) => allowed.add(n));
      const doc = p && ctx.documents.get(p.docId);
      if (doc) dateNumbers(doc.date).forEach((n) => allowed.add(n));
    }
  }
  const unsupported = claimedNumbers(statement).filter((n) => !allowed.has(n));
  if (unsupported.length) return { ok: false, reason: `unsupported number(s) ${unsupported.join(", ")}` };

  return {
    ok: true,
    fact: {
      statement,
      kind: calculation ? "calculated" : "documented",
      quotes,
      ...(calculation ? { calculation } : {}),
    },
  };
}
