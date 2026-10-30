import { NextResponse } from "next/server";
import { badRequest, requireUser } from "@/lib/api";
import { explainItem } from "@/lib/briefing/explain";
import { llmConfigured } from "@/lib/llm/provider";
import { getSituation, rolesFor } from "@/lib/repo";

// Why a briefing item matters for the user's role and the situation (briefing only, not chat).
export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const body = (await request.json().catch(() => ({}))) as { situationId?: number; label?: string };
  const situation = body.situationId ? getSituation(Number(body.situationId)) : null;
  const label = String(body.label ?? "").trim();
  if (!situation) return badRequest("Unknown situation.");
  if (!label || label.length > 200) return badRequest("Missing or too long item label.");
  if (!llmConfigured()) return NextResponse.json({ error: "The AI model is not configured." }, { status: 503 });
  try {
    const explanation = await explainItem({ roles: rolesFor(user.role, situation), situation, label });
    return NextResponse.json({ explanation });
  } catch (err) {
    console.error("[explain] failed:", err instanceof Error ? err.message.slice(0, 200) : err);
    return NextResponse.json({ error: "No explanation available right now. Please retry." }, { status: 504 });
  }
}
