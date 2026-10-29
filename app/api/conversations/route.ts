import { NextResponse } from "next/server";
import { badRequest, requireUser } from "@/lib/api";
import { createConversation, listConversations, logAudit, openConversation } from "@/lib/repo";

export async function GET(request: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const patientId = new URL(request.url).searchParams.get("patientId");
  if (!patientId) return badRequest("patientId is required.");
  return NextResponse.json({ conversations: listConversations(user.id, patientId) });
}

/** Open (or with fresh=true, start) the conversation for a patient + situation. */
export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const body = (await request.json().catch(() => ({}))) as { patientId?: string; situationId?: number | null; fresh?: boolean };
  if (!body.patientId) return badRequest("patientId is required.");
  const situationId = body.situationId ? Number(body.situationId) : null;
  const conv = body.fresh
    ? createConversation(user.id, body.patientId, situationId)
    : openConversation(user.id, body.patientId, situationId);
  logAudit(user.id, body.patientId, "select_situation", { situationId, conversationId: conv.id });
  return NextResponse.json({ conversation: conv });
}
