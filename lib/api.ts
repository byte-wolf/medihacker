import "server-only";
import { NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";

/** Resolve the session user for an API route, or a 401 response. */
export async function requireUser(): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser();
  return user ?? NextResponse.json({ error: "Not logged in" }, { status: 401 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}
