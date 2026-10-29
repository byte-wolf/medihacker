import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { setSession } from "@/lib/auth/session";
import { logAudit } from "@/lib/repo";

export async function POST(request: Request) {
  const { username } = (await request.json().catch(() => ({}))) as { username?: string };
  const name = String(username ?? "").trim().toLowerCase();
  const user = name ? getDb().select().from(schema.users).where(eq(schema.users.username, name)).get() : undefined;
  if (!user) return NextResponse.json({ error: "Unknown user name." }, { status: 404 });
  await setSession(user.id);
  logAudit(user.id, null, "login");
  return NextResponse.json({ ok: true });
}
