import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { getPatient } from "@/lib/data/patients";
import { ensureTranslations, translationsForDocument } from "@/lib/data/translations";
import { LlmRequestError, llmErrorMessage } from "@/lib/llm/provider";

/** Full document text with passage offsets (for highlighting) and cached English translations. */
export async function GET(_request: Request, ctx: RouteContext<"/api/documents/[patientId]/[docId]">) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { patientId, docId } = await ctx.params;
  const patient = getPatient(patientId);
  const doc = patient?.documents.find((d) => d.id === docId);
  if (!patient || !doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    document: doc,
    passages: patient.passages.filter((p) => p.docId === docId).map(({ id, start, end }) => ({ id, start, end })),
    translations: translationsForDocument(patient, docId),
  });
}

/** Translation is requested explicitly, for highlighted passages only. */
export async function POST(request: Request, ctx: RouteContext<"/api/documents/[patientId]/[docId]">) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { patientId, docId } = await ctx.params;
  const patient = getPatient(patientId);
  if (!patient || !patient.documents.some((d) => d.id === docId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.passageIds) || !body.passageIds.length || body.passageIds.length > 20) {
    return NextResponse.json({ error: "Select between 1 and 20 passages to translate." }, { status: 400 });
  }
  const valid = new Set(patient.passages.filter((p) => p.docId === docId).map((p) => p.id));
  if (!body.passageIds.every((id: unknown) => typeof id === "string" && valid.has(id))) {
    return NextResponse.json({ error: "Unknown passage." }, { status: 400 });
  }
  try {
    await ensureTranslations(patient, body.passageIds);
    return NextResponse.json({ translations: translationsForDocument(patient, docId) });
  } catch (err) {
    console.error("[translations] failed:", err);
    return NextResponse.json({ error: llmErrorMessage(err, "Translation could not be generated. Please try again.") }, { status: err instanceof LlmRequestError && err.status === 429 ? 429 : 502 });
  }
}
