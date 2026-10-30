// Formatting helpers shared by server and client.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m) return iso;
  return d ? `${d} ${MONTHS[m - 1]} ${y}` : `${MONTHS[m - 1]} ${y}`;
}

/** Short label for a document type, e.g. "Discharge letter". */
export function docKindLabel(title: string, type: string): string {
  const t = `${title} ${type}`.toLowerCase();
  if (t.includes("stat. patientenbrief") || t.includes("arztbrief")) return "Discharge letter";
  if (t.includes("ambulan")) return "Outpatient letter";
  if (t.includes("histo")) return "Pathology report";
  if (t.includes("radiolog") || t.includes("sonograph")) return "Radiology report";
  if (t.includes("konsil")) return "Ophthalmology consult";
  if (t.includes("langzeit-ekg")) return "Holter ECG";
  if (t.includes("24h-rr")) return "24-h BP monitoring";
  return title;
}

/** Compact document kind for inline source links, e.g. "Discharge". */
export function docKindShort(title: string, type: string): string {
  const kind = docKindLabel(title, type);
  const short: Record<string, string> = {
    "Discharge letter": "Discharge",
    "Outpatient letter": "Outpatient",
    "Pathology report": "Pathology",
    "Radiology report": "Radiology",
    "Ophthalmology consult": "Eye consult",
    "Holter ECG": "Holter ECG",
    "24-h BP monitoring": "24-h BP",
  };
  if (short[kind]) return short[kind];
  return kind.length > 18 ? `${kind.slice(0, 17).trimEnd()}…` : kind;
}

/** "25 Oct", with the year only when it differs from `refYear` (e.g. the latest document's year). */
export function formatShortDate(iso: string, refYear?: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m) return iso;
  const year = y === refYear ? "" : ` ${y}`;
  return d ? `${d} ${MONTHS[m - 1]}${year}` : `${MONTHS[m - 1]}${year || ` ${y}`}`;
}
