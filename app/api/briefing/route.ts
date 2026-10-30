import { NextResponse } from "next/server";
import { badRequest, requireUser } from "@/lib/api";
import { buildBriefing } from "@/lib/briefing/pipeline";
import { getPatient } from "@/lib/data/patients";
import { getSituation, logAudit, rolesFor } from "@/lib/repo";
import type { BriefingStreamEvent } from "@/lib/types";
import { llmErrorMessage } from "@/lib/llm/provider";

// Streams the briefing as NDJSON: one event per line, sections arrive as they are verified.
export async function POST(request: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const body = (await request.json().catch(() => ({}))) as { patientId?: string; situationId?: number | null };
  const patient = body.patientId ? getPatient(body.patientId) : null;
  if (!patient) return badRequest("Unknown patient.");
  const situation = body.situationId ? getSituation(Number(body.situationId)) : null;
  if (body.situationId && !situation) return badRequest("Unknown situation.");
  const roles = rolesFor(user.role, situation);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: BriefingStreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        const result = await buildBriefing(patient, roles, situation, emit);
        logAudit(user.id, patient.id, "view_briefing", {
          situationId: situation?.id ?? null,
          ms: result.ms,
          facts: result.sections.flatMap((s) => s.items.flatMap((i) => i.facts.flatMap((f) => f.quotes.map((q) => q.passageId)))),
        });
      } catch (err) {
        console.error("[briefing] failed:", err);
        emit({ type: "error", message: llmErrorMessage(err, "The briefing could not be generated. Please retry.") });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
