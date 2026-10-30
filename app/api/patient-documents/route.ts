import { NextResponse } from "next/server";
import { badRequest, requireUser } from "@/lib/api";
import { getPatient } from "@/lib/data/patients";
import { isDocumentType } from "@/lib/documents/catalog";
import { ASA_CLASSES, saveBlockers, suggestAsa, type Checklist } from "@/lib/documents/anesthesia";
import { createPatientDocument, logAudit } from "@/lib/repo";

export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const body = (await request.json().catch(() => ({}))) as { patientId?: string; type?: string; content?: Checklist };
  const patient = body.patientId ? getPatient(body.patientId) : null;
  if (!patient) return badRequest("Unknown patient.");
  if (!isDocumentType(body.type)) return badRequest("Unknown document type.");
  const content = body.content;
  if (!content?.identity || !content.allergies || !content.exam || !content.asa || !content.confirmations || !Array.isArray(content.conditions)) {
    return badRequest("The checklist is incomplete.");
  }
  if (JSON.stringify(content).length > 200_000) return badRequest("The checklist is too large.");
  if (content.identity.patientId !== patient.id) return badRequest("The checklist belongs to a different patient.");
  if (content.asa.finalClass && !ASA_CLASSES.includes(content.asa.finalClass)) return badRequest("Unknown ASA class.");
  const blockers = saveBlockers(content);
  if (blockers.length) return NextResponse.json({ error: "The checklist cannot be saved yet.", blockers }, { status: 400 });

  const suggested = suggestAsa(content);
  const doc = createPatientDocument(user.id, patient.id, body.type, content, content.asa.finalClass);
  logAudit(user.id, patient.id, "create_document", {
    documentId: doc.id,
    type: body.type,
    asaClass: content.asa.finalClass,
    asaSuggested: suggested.status === "complete" ? suggested.asaClass : null,
  });
  return NextResponse.json({ document: { id: doc.id, createdAt: doc.createdAt } });
}
