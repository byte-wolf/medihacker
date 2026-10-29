import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { getPatient } from "@/lib/data/patients";
import { ensureTranslations, translationsForDocument } from "@/lib/data/translations";

/** Full document text with passage offsets (for highlighting) and cached English translations. */
export async function GET(_request: Request, ctx: RouteContext<"/api/documents/[patientId]/[docId]">) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { patientId, docId } = await ctx.params;
  const patient = getPatient(patientId);
  const doc = patient?.documents.find((d) => d.id === docId);
  if (!patient || !doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  void ensureTranslations(patient);
  return NextResponse.json({
    document: doc,
    passages: patient.passages.filter((p) => p.docId === docId).map(({ id, start, end }) => ({ id, start, end })),
    translations: translationsForDocument(patient, docId),
  });
}
