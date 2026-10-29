import { NextResponse } from "next/server";
import { badRequest, requireUser } from "@/lib/api";
import { createSituation, logAudit } from "@/lib/repo";

export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const body = (await request.json().catch(() => ({}))) as { title?: string; description?: string; patientId?: string };
  const title = String(body.title ?? "").trim();
  const description = String(body.description ?? "").trim();
  if (!title) return badRequest("Please enter a title.");
  if (title.length > 200 || description.length > 4000) return badRequest("Title or description is too long.");
  const situation = createSituation(user.id, title, description);
  logAudit(user.id, body.patientId ?? null, "create_situation", { situationId: situation.id, title });
  return NextResponse.json({ situation });
}
