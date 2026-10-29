/**
 * parse.ts — Document HTML parsing and passage segmentation.
 *
 * A "passage" is one of:
 *   - A sentence (within narrative paragraphs)
 *   - One key:value vital-sign line  ("Gewicht: 78 kg")
 *   - One diagnosis-list line
 *   - One medication row
 *
 * Each passage gets a stable ID "docId:pNNN" and stores the char offsets
 * into the plain-text version of the document.
 */

export interface ParsedPassage {
  id: string;        // "docId:pNNN"
  docId: string;
  section: string;   // Diagnosen | Allergien | Anamnese | Entlassungsmedikation | …
  text: string;      // the plain-text passage
  startOffset: number;
  endOffset: number;
}

export interface ParsedDocument {
  id: string;
  plainText: string;
  passages: ParsedPassage[];
}

// ── HTML → plain text ──────────────────────────────────────────────────────

/** Convert the document's HTML-like text field into plain text. */
export function htmlToPlainText(raw: string): string {
  return raw
    .replace(/<BR\s*\/?>/gi, "\n")        // <BR> → newline
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&auml;/g, "ä")
    .replace(/&ouml;/g, "ö")
    .replace(/&uuml;/g, "ü")
    .replace(/&Auml;/g, "Ä")
    .replace(/&Ouml;/g, "Ö")
    .replace(/&Uuml;/g, "Ü")
    .replace(/&szlig;/g, "ß")
    .replace(/&nbsp;/g, " ")
    .replace(/&deg;/g, "°")
    .replace(/&micro;/g, "µ")
    .replace(/<[^>]+>/g, "")             // strip any remaining tags
    .replace(/[ \t]+/g, " ")             // collapse horizontal whitespace
    .replace(/\n{3,}/g, "\n\n");         // max 2 consecutive newlines
}

// ── Section detection ──────────────────────────────────────────────────────

const SECTION_PATTERNS: [RegExp, string][] = [
  [/^Diagnosen?\s*:?$/i, "Diagnosen"],
  [/^Allergien?\s*:?$/i, "Allergien"],
  [/^Anamnese\s*:?$/i, "Anamnese"],
  [/^Entlassungsmedikation\s*:?$/i, "Entlassungsmedikation"],
  [/^Medikation\s*:?$/i, "Medikation"],
  [/^Therapie und Verlauf\s*:?$/i, "Therapie und Verlauf"],
  [/^Verlauf\s*:?$/i, "Verlauf"],
  [/^Procedere\s*:?$/i, "Procedere"],
  [/^Erhobene Befunde\s*:?$/i, "Befunde"],
  [/^Befundzusammenfassung\s*:?$/i, "Befundzusammenfassung"],
  [/^Zusammenfassung\s*:?$/i, "Zusammenfassung"],
  [/^Labor\s*:?$/i, "Labor"],
  [/^EKG\s*.*$/i, "EKG"],
  [/^Immunhistologisches Profil\s*:?$/i, "Immunhistologie"],
  [/^Mikroskopischer Befund\s*:?$/i, "Histologie"],
  [/^Makroskopischer Befund\s*:?$/i, "Histologie"],
  [/^Ultraschalluntersuchung/i, "Ultraschall"],
  [/^Histologie\s/i, "Histologie"],
  [/^Histopathologischer Befund\s*:?$/i, "Histologie"],
  [/^Interne-Status präsens\s*:?$/i, "Status"],
  [/^Gesamtbeurteilung\s*:?$/i, "Beurteilung"],
  [/^Doppler\/Duplex\s/i, "Gefäßsonographie"],
];

function detectSection(line: string, currentSection: string): string {
  const trimmed = line.trim();
  for (const [pattern, name] of SECTION_PATTERNS) {
    if (pattern.test(trimmed)) return name;
  }
  return currentSection;
}

// ── Vital-sign line detection ──────────────────────────────────────────────

const VITAL_PATTERN = /^(Größe|Gewicht|BMI|Blutdruck|RR|HF|Körpertemperatur|Temperatur|MMSE)\s*[:=]/i;

// ── Passage segmentation ───────────────────────────────────────────────────

/**
 * Split the plain text of one document into passages with stable IDs.
 * Returns passages and the full plain text (which the IDs' offsets index into).
 */
export function segmentDocument(docId: string, plainText: string): ParsedPassage[] {
  const passages: ParsedPassage[] = [];
  let passageIndex = 0;
  let currentSection = "Header";
  let offset = 0;

  const lines = plainText.split("\n");

  // We track char offset as we walk through lines
  let cursor = 0;

  for (const line of lines) {
    const lineStart = cursor;
    cursor += line.length + 1; // +1 for the \n

    const trimmed = line.trim();
    if (!trimmed) continue;

    // Update section heading
    const newSection = detectSection(trimmed, currentSection);
    if (newSection !== currentSection) {
      currentSection = newSection;
      continue; // The heading itself is not a passage
    }

    // Skip pure address / salutation lines
    if (/^(Frau|Herr|Sehr geehrte|Mit kollegialen|ORTXXX|OrtXX|Ort,|ARZT|befundet|vidiert|Befund:|Vidiert:)/i.test(trimmed)) {
      continue;
    }
    // Skip short label-only lines that are not vital signs
    if (trimmed.length < 5 && !/\d/.test(trimmed)) continue;

    // Vital-sign / structured key:value lines → one passage each
    if (VITAL_PATTERN.test(trimmed)) {
      passages.push({
        id: `${docId}:p${String(passageIndex).padStart(3, "0")}`,
        docId,
        section: currentSection,
        text: trimmed,
        startOffset: lineStart,
        endOffset: lineStart + trimmed.length,
      });
      passageIndex++;
      continue;
    }

    // Medication rows (lines with dose patterns like "1-0-0", "1-1-1", "0-1-0")
    if (/\b\d+[-–]\d+[-–]\d+\b/.test(trimmed)) {
      passages.push({
        id: `${docId}:p${String(passageIndex).padStart(3, "0")}`,
        docId,
        section: currentSection,
        text: trimmed,
        startOffset: lineStart,
        endOffset: lineStart + trimmed.length,
      });
      passageIndex++;
      continue;
    }

    // Diagnosis / finding lines in list sections
    if (
      ["Diagnosen", "Allergien", "Befunde", "Befundzusammenfassung", "Histologie", "Immunhistologie"].includes(
        currentSection
      )
    ) {
      passages.push({
        id: `${docId}:p${String(passageIndex).padStart(3, "0")}`,
        docId,
        section: currentSection,
        text: trimmed,
        startOffset: lineStart,
        endOffset: lineStart + trimmed.length,
      });
      passageIndex++;
      continue;
    }

    // Sentences in narrative sections — split by sentence boundary
    const sentences = splitSentences(trimmed);
    let sentCursor = lineStart;
    for (const sentence of sentences) {
      const s = sentence.trim();
      if (!s) continue;
      // Find this sentence in the line starting from sentCursor
      const relIdx = plainText.indexOf(s, sentCursor);
      const startOff = relIdx >= 0 ? relIdx : sentCursor;
      passages.push({
        id: `${docId}:p${String(passageIndex).padStart(3, "0")}`,
        docId,
        section: currentSection,
        text: s,
        startOffset: startOff,
        endOffset: startOff + s.length,
      });
      passageIndex++;
      sentCursor = startOff + s.length;
    }
  }

  return passages;
}

/** Split text into sentences on German sentence boundaries. */
function splitSentences(text: string): string[] {
  // Split on ". " or "! " or "? " followed by a capital letter or end of string
  // But don't split on common abbreviations like "z.B.", "Dr.", "Nr."
  const parts = text.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ])/);
  return parts.filter((p) => p.trim().length > 0);
}

// ── Public entry point ─────────────────────────────────────────────────────

export interface DocumentJson {
  metadata: {
    id: string;
    title: string;
    date: string;
    type: string;
    group: string;
    division: string;
    hospital: string;
    department: string;
    admission?: {
      id: string;
      type: string;
      admission: { date: string; time: string };
      discharge: { date: string; time: string };
    };
  };
  text: string;
}

export function parseDocument(doc: DocumentJson): ParsedDocument {
  const plainText = htmlToPlainText(doc.text);
  const passages = segmentDocument(doc.metadata.id, plainText);
  return { id: doc.metadata.id, plainText, passages };
}
