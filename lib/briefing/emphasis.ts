// Which parts of a fact statement to bold: only the clinical value (number + unit, drug + dose,
// named lab value, allergen). Deterministic; when nothing matches, nothing is bold.

export type Span = { text: string; strong: boolean };

const NUM = String.raw`[−+-]?\d+(?:[.,]\d+)?`;
const UNIT = String.raw`(?:mmHg|mmol\/l|mg\/dl|ml\/min(?:\/1[.,]73\s?m²)?|µmol\/l|g\/dl|mg|µg|mcg|ng|ml|kg|cm|IE|IU|bpm|\/min|%|°C|g|l|m)`;
// "88 → 85 → 86 kg", "152/88 mmHg", "100mg", "−2 kg"
const VALUE = String.raw`${NUM}(?:\s*(?:→|->|–|\/)\s*${NUM})*\s?${UNIT}(?![\wäöüß])`;
const DOSE_UNIT = String.raw`(?:mg|µg|mcg|g|ml|IE|IU)`;
const DRUG_WORD = String.raw`[A-ZÄÖÜ][\wÄÖÜäöüß-]*`;
const NOT_DRUG = /^(The|She|He|Her|His|Patient|Takes|Taking|On|Since|Daily|Dose|Current|Latest|Weight|Height|Change|Stop|Until|Pause|And|Or|With|Plus)$/;

const PATTERNS: RegExp[] = [
  // Drug name (up to three words) directly followed by its dose: "Thrombo ASS 100mg"
  new RegExp(String.raw`(?:${DRUG_WORD}\s){0,2}${DRUG_WORD}\s?\d+(?:[.,]\d+)?\s?${DOSE_UNIT}(?![\wäöüß])`, "g"),
  // Named values without a unit: "BMI 29.1", "eGFR 45", "HbA1c 7.2 %", "RR: 152/88 mmHg"
  new RegExp(String.raw`\b(?:BMI|eGFR|GFR|HbA1c|LVEF|EF|INR|RR|HF|SpO2|Kreatinin|Creatinine)\s*:?\s*${NUM}(?:\/\d+)?(?:\s?${UNIT}(?![\wäöüß]))?`, "g"),
  new RegExp(VALUE, "g"),
  // Allergens: "allergy to iodinated contrast media", "Penicillin-Allergie", "Allergie gegen Latex"
  /(?<=\ballerg(?:y|ic|ies) (?:to|against) )[^,.;()]+?(?=\s+(?:with|manifesting|causing|resulting|presenting|leading)\b|[,.;()]|$)/gi,
  /(?<=\bintoleran(?:ce|t) (?:to|of) )[^,.;()]+?(?=\s+(?:with|manifesting|causing)\b|[,.;()]|$)/gi,
  /[\wÄÖÜäöüß]+(?:[ -][\wÄÖÜäöüß]+)?-?(?:Allergie|allergie|Unverträglichkeit|unverträglichkeit)\b/g,
  /(?<=\b(?:Allergie|Unverträglichkeit) gegen )[^,.;()]+?(?=[,.;()]|$)/g,
  /\b[A-Z][\w-]*(?: [a-z][\w-]*){0,2} allergy\b/g,
];

const MAX_SPANS = 4;

/** Split a statement into plain and bold parts; at most a few bold spans, never overlapping. */
export function emphasisSpans(text: string): Span[] {
  const found: [number, number][] = [];
  for (const re of PATTERNS) {
    for (const m of text.matchAll(re)) {
      let start = m.index!;
      let value = m[0];
      if (re === PATTERNS[0]) {
        // Drop leading sentence words that are not part of the drug name ("Takes ASS 100mg").
        const words = value.split(/\s+/);
        while (words.length > 1 && NOT_DRUG.test(words[0])) {
          start += value.indexOf(words[1], words[0].length);
          value = text.slice(start, m.index! + m[0].length);
          words.shift();
        }
      }
      const end = start + value.trimEnd().length;
      if (end > start && !found.some(([s, e]) => start < e && end > s)) found.push([start, end]);
    }
  }
  found.sort((a, b) => a[0] - b[0]);
  const spans: Span[] = [];
  let pos = 0;
  for (const [s, e] of found.slice(0, MAX_SPANS)) {
    if (s > pos) spans.push({ text: text.slice(pos, s), strong: false });
    spans.push({ text: text.slice(s, e), strong: true });
    pos = e;
  }
  if (pos < text.length) spans.push({ text: text.slice(pos), strong: false });
  return spans;
}

/** "No known allergies" / "keine bekannt": documented, but not an alert. */
export function isNoAllergyStatement(statement: string): boolean {
  return /\b(no known|none known|no (documented )?allerg|NKDA|keine( bekannten)?( Allergien)?\b|nicht bekannt|ohne Allergie)/i.test(statement);
}
