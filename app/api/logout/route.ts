import { NextResponse } from "next/server";
import { clearSession, getSessionUser } from "@/lib/auth/session";
import { logAudit } from "@/lib/repo";

export async function POST() {
  const user = await getSessionUser();
  if (user) logAudit(user.id, null, "logout");
  await clearSession();
  return NextResponse.json({ ok: true });
}
