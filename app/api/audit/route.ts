import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { logAudit } from "@/lib/repo";

const ALLOWED = new Set(["open_patient", "open_source", "open_contradiction"]);

export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const body = (await request.json().catch(() => ({}))) as { patientId?: string; action?: string; details?: unknown };
  if (!body.action || !ALLOWED.has(body.action)) return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  logAudit(user.id, body.patientId ?? null, body.action, body.details);
  return NextResponse.json({ ok: true });
}
