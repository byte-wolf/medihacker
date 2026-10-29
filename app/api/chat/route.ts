import { NextResponse } from "next/server";
import { badRequest, requireUser } from "@/lib/api";
import { answerQuestion, summarizeItems, type ChatTurn } from "@/lib/chat/answer";
import { getPatient } from "@/lib/data/patients";
import { addMessage, getConversation, getSituation, listMessages, logAudit, rolesFor } from "@/lib/repo";
import type { BriefingItem } from "@/lib/types";

export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const body = (await request.json().catch(() => ({}))) as { conversationId?: number; question?: string };
  const question = String(body.question ?? "").trim();
  if (!question) return badRequest("Please enter a question.");
  if (question.length > 2000) return badRequest("The question is too long.");
  const conv = body.conversationId ? getConversation(Number(body.conversationId), user.id) : null;
  if (!conv) return badRequest("Unknown conversation.");
  const patient = getPatient(conv.patientId);
  if (!patient) return badRequest("Unknown patient.");
  const situation = conv.situationId ? getSituation(conv.situationId) : null;

  const history: ChatTurn[] = listMessages(conv.id).map((m) =>
    m.role === "user"
      ? { role: "user", text: (m.content as { text: string }).text }
      : { role: "assistant", text: summarizeItems((m.content as { items: BriefingItem[] }).items) },
  );
  const userMsg = addMessage(conv.id, "user", { text: question });
  try {
    const { items, ms } = await answerQuestion({ patient, roles: rolesFor(user.role, situation), situation, history, question });
    const reply = addMessage(conv.id, "assistant", { items }, ms);
    logAudit(user.id, patient.id, "ask_question", { conversationId: conv.id, question, ms });
    return NextResponse.json({ user: userMsg, reply });
  } catch (err) {
    console.error("[chat] failed:", err);
    return NextResponse.json({ error: "The answer could not be generated. Please retry.", user: userMsg }, { status: 502 });
  }
}
