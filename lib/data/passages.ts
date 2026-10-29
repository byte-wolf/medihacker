import type { Passage } from "@/lib/types";

type Line = { text: string; start: number; end: number };
type Block = { start: number; end: number; kind: Passage["kind"]; section: string | null };

// Abbreviations after which a period does not end a sentence (lower-cased, without the dot).
const ABBREVIATIONS = new Set([
  "pat", "li", "re", "bds", "z.b", "dr", "st.p", "z.n", "ca", "v.a", "vd.a", "geb", "prim",
  "sin", "dext", "ventr", "art", "diab", "mell", "a", "aa", "inkl", "evtl", "ggf", "bzw", "nr",
  "stat", "amb", "tabl", "mo", "mi", "ab", "na", "abt", "med", "chir", "kons", "lt", "vs", "i.v",
  "s.c", "p.o", "u.a", "o.g", "mind", "max", "min", "std", "sek", "wg", "ggü", "abb", "etc", "oa",
]);

// Common German clinical headings that appear without a trailing colon.
const BARE_HEADINGS = new Set([
  "gesamtbeurteilung", "befundzusammenfassung", "zusammenfassung", "beurteilung", "befund",
  "laborbefund", "parameter", "mit freundlichen grüßen", "mit kollegialen grüßen",
  "radiologischer befund", "langzeit-ekg", "24h-rr-messung", "konsil für augenheilkunde",
  "histopathologischer befund", "ambulanter patientenbrief", "diagnosen", "allergien",
  "anamnese", "procedere", "therapie", "verlauf", "empfehlung", "medikation",
]);

const GENERIC_SUBHEADINGS = new Set(["zusammenfassung", "befundzusammenfassung", "gesamtbeurteilung", "beurteilung"]);

/** A short line ending with ":" or a known bare heading that introduces a block. */
function isHeading(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 90) return false;
  if (/:$/.test(t) && !/:\s*\S.*:$/.test(t.slice(0, -1))) return true;
  return BARE_HEADINGS.has(t.replace(/[,.]$/, "").toLowerCase());
}

/** "Key: value" lines (vitals, findings) and table rows are kept as single passages. */
function isStandaloneLine(line: string): boolean {
  const t = line.trim();
  if (/^[A-ZÄÖÜa-zäöü][\wäöüßÄÖÜ .()/\-]{0,40}:\s*\S/.test(t)) return true; // key: value
  if (/\b\d+(?:[.,]\d+)?\s*(?:\d+\/\d+|\d+)\s+\d+\s+\d+\b/.test(t)) return true; // medication schedule columns
  if (/^\s*\S.*\|\s*\S/.test(t)) return true; // pipe-separated header rows
  return false;
}

function isKeyValue(line: string): boolean {
  return /^[A-ZÄÖÜa-zäöü][\wäöüßÄÖÜ\-]{0,30}:\s+\S/.test(line.trim());
}

function endsSentence(text: string): boolean {
  return /[.!?:;]\s*$/.test(text.trim());
}

/** True if the line is cut mid-sentence and the next non-blank line continues it in lower case. */
function continuesOnNextLine(lines: Line[], i: number): boolean {
  if (endsSentence(lines[i].text)) return false;
  const next = lines.slice(i + 1).find((l) => l.text.trim());
  return !!next && /^[a-zäöü]/.test(next.text.trim()) && !isKeyValue(next.text);
}

function splitLines(text: string): Line[] {
  const lines: Line[] = [];
  let pos = 0;
  for (const raw of text.split("\n")) {
    lines.push({ text: raw, start: pos, end: pos + raw.length });
    pos += raw.length + 1;
  }
  return lines;
}

/** Trim whitespace from a [start, end) range of `text`. */
function trimRange(text: string, start: number, end: number): [number, number] {
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  return [start, end];
}

/** Split a prose block into sentences, returning absolute [start, end) ranges. */
export function splitSentences(text: string, start: number, end: number): [number, number][] {
  const out: [number, number][] = [];
  let sentenceStart = start;
  const re = /[.!?](?=\s+["„(]?[A-ZÄÖÜ0-9])/g;
  re.lastIndex = start;
  const slice = text.slice(0, end);
  let m: RegExpExecArray | null;
  while ((m = re.exec(slice)) !== null) {
    if (m.index >= end) break;
    const before = text.slice(sentenceStart, m.index);
    const lastToken = (before.match(/(\S+)$/)?.[1] ?? "").toLowerCase();
    // Do not split after abbreviations, single letters, or numbers ("03. April", "15.03.1959")
    if (ABBREVIATIONS.has(lastToken) || /^\d+$/.test(lastToken) || /^[a-zäöü]$/.test(lastToken) || /\w\.\w+$/.test(lastToken)) {
      continue;
    }
    const [s, e] = trimRange(text, sentenceStart, m.index + 1);
    if (e > s) out.push([s, e]);
    sentenceStart = m.index + 1;
  }
  const [s, e] = trimRange(text, sentenceStart, end);
  if (e > s) out.push([s, e]);
  return out;
}

/**
 * Segment a decoded document into citable passages: headings, single lines
 * (key/value, list and table rows) and sentences of prose paragraphs.
 * Offsets refer to `text`, so a passage can always be highlighted in the original.
 */
export function segmentDocument(docId: string, text: string): Passage[] {
  const lines = splitLines(text);
  const blocks: Block[] = [];
  let section: string | null = null;
  let prose: Block | null = null; // open prose paragraph that may continue on the next line
  let lastProseLine = "";

  const closeProse = () => {
    if (prose) blocks.push(prose);
    prose = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.text.trim();
    if (!t) {
      // A blank line ends a paragraph unless the sentence obviously continues (next line starts lower case).
      const next = lines.slice(i + 1).find((l) => l.text.trim());
      if (prose && next && /^[a-zäöü]/.test(next.text.trim()) && !isKeyValue(next.text) && !endsSentence(lastProseLine)) continue;
      closeProse();
      continue;
    }

    // Continuation of a prose paragraph that was broken mid-sentence.
    if (prose && !endsSentence(lastProseLine) && !isKeyValue(t) && (/^[a-zäöü(]/.test(t) || !isStandaloneLine(t))) {
      if (!isHeading(t) || /^[a-zäöü]/.test(t)) {
        prose.end = line.end;
        lastProseLine = t;
        continue;
      }
    }
    closeProse();

    const [s, e] = trimRange(text, line.start, line.end);
    if (isHeading(t)) {
      const title = t.replace(/[:,]$/, "").trim();
      // "Zusammenfassung" within "Histologie vom 13.04.2016:" becomes "Histologie vom 13.04.2016 › Zusammenfassung"
      const parent: string | undefined = section === null ? undefined : String(section).split(" › ")[0];
      const nested: boolean = !!parent && GENERIC_SUBHEADINGS.has(title.toLowerCase()) && !GENERIC_SUBHEADINGS.has(parent.toLowerCase());
      section = nested ? `${parent} › ${title}` : title;
      blocks.push({ start: s, end: e, kind: "heading", section });
    } else if (isStandaloneLine(t) || (t.length < 70 && !continuesOnNextLine(lines, i))) {
      blocks.push({ start: s, end: e, kind: "line", section });
      // A key/value line that does not end its sentence may continue on the next line ("Indikation: ... ,").
      if (!endsSentence(t) && /[,(]$/.test(t)) {
        const last = blocks.pop()!;
        prose = { ...last, kind: "sentence" };
        lastProseLine = t;
      }
    } else {
      prose = { start: s, end: e, kind: "sentence", section };
      lastProseLine = t;
    }
  }
  closeProse();

  const passages: Passage[] = [];
  for (const b of blocks) {
    // Prose and long key/value lines are split into sentences; table rows and short lines stay whole.
    const split = b.kind === "sentence" || (b.kind === "line" && b.end - b.start > 120);
    const ranges = split ? splitSentences(text, b.start, b.end) : [[b.start, b.end] as [number, number]];
    for (const [s, e] of ranges) {
      const n = String(passages.length + 1).padStart(3, "0");
      passages.push({
        id: `${docId}:p${n}`,
        docId,
        section: b.kind === "heading" ? null : b.section,
        kind: ranges.length > 1 ? "sentence" : b.kind,
        text: text.slice(s, e),
        start: s,
        end: e,
      });
    }
  }
  return passages;
}
