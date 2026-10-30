// German clinical abbreviations as used in the hospital documents, resolved once for every prompt.
// A model without context can guess wrong (e.g. "KM-Allergie" as cow's milk allergy, when it means
// contrast medium). Wrong meanings are listed where a model is known to make them.

export const ABBREVIATIONS: { abbr: string; meaning: string; notMeaning?: string }[] = [
  { abbr: "KM", meaning: "Kontrastmittel = contrast medium (iodinated or gadolinium)", notMeaning: "Kuhmilch / cow's milk" },
  { abbr: "ASS", meaning: "Acetylsalicylsäure = acetylsalicylic acid (aspirin)" },
  { abbr: "RR", meaning: "Blutdruck (Riva-Rocci) = blood pressure" },
  { abbr: "HF", meaning: "Herzfrequenz = heart rate", notMeaning: "heart failure" },
  { abbr: "Z.n. / St.p.", meaning: "Zustand nach / Status post = history of, after" },
  { abbr: "V.a.", meaning: "Verdacht auf = suspected" },
  { abbr: "DM / DMII", meaning: "Diabetes mellitus (type 2)" },
  { abbr: "KHK", meaning: "koronare Herzkrankheit = coronary artery disease" },
  { abbr: "pAVK", meaning: "periphere arterielle Verschlusskrankheit = peripheral artery disease" },
  { abbr: "ITN", meaning: "Intubationsnarkose = general anaesthesia with intubation" },
  { abbr: "OP", meaning: "Operation = surgery" },
  { abbr: "li. / re. / bds.", meaning: "links / rechts / beidseits = left / right / bilateral" },
  { abbr: "Krea", meaning: "Kreatinin = creatinine" },
  { abbr: "NW", meaning: "Nebenwirkung = side effect" },
  { abbr: "KI", meaning: "Kontraindikation = contraindication", notMeaning: "artificial intelligence" },
  { abbr: "CAVE", meaning: "warning (allergy or hazard)" },
  { abbr: "IORT", meaning: "intraoperative Radiotherapie = intraoperative radiotherapy" },
  { abbr: "TEP", meaning: "Totalendoprothese = total joint replacement" },
  { abbr: "EF", meaning: "Ejektionsfraktion = ejection fraction" },
  { abbr: "1-0-1 / 1 0 0 0", meaning: "dosing schedule morning-midday-evening(-night)" },
];

/** Glossary block for system prompts. */
export const GLOSSARY = `GERMAN CLINICAL ABBREVIATIONS in these documents (always use these meanings):
${ABBREVIATIONS.map((a) => `- ${a.abbr}: ${a.meaning}${a.notMeaning ? ` (never ${a.notMeaning})` : ""}`).join("\n")}`;

/** Bump when the glossary or translation prompt changes, so stored translations are redone. */
export const TRANSLATION_VERSION = "t2";

// Mistranslations a model is known to produce: if the German source has the pattern and the
// English text has the wrong meaning, the translation is rejected, unless the source really
// speaks about that meaning (e.g. "Milchunverträglichkeit" next to "KM-Gabe").
const KNOWN_ERRORS: { source: RegExp; wrong: RegExp; unlessSource: RegExp }[] = [
  { source: /\bKM\b|KM-/, wrong: /\bmilk\b/i, unlessSource: /milch|laktose|lactose/i },
  { source: /\bKI\b/, wrong: /artificial intelligence|\bAI\b/, unlessSource: /künstliche intelligenz/i },
];

/** False when a translation contains a known wrong meaning of an abbreviation in its source. */
export function translationIsSafe(source: string, translation: string): boolean {
  return !KNOWN_ERRORS.some((e) => e.source.test(source) && e.wrong.test(translation) && !e.unlessSource.test(source));
}
