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
