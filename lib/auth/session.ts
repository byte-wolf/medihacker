import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

// Prototype login: username only, no password. The cookie is signed so it
// cannot be edited to impersonate another user.

const COOKIE = "mh_session";

function secret() {
  return process.env.SESSION_SECRET || "medihacker-dev-secret";
}

function sign(value: string) {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex").slice(0, 32);
}

export function sessionValue(userId: number) {
  return `${userId}.${sign(String(userId))}`;
}

export function parseSessionValue(raw: string | undefined): number | null {
  if (!raw) return null;
  const [id, sig] = raw.split(".");
  if (!id || !sig || sign(id) !== sig) return null;
  return Number(id);
}

export type SessionUser = typeof schema.users.$inferSelect;

export async function getSessionUser(): Promise<SessionUser | null> {
  const userId = parseSessionValue((await cookies()).get(COOKIE)?.value);
  if (!userId) return null;
  return getDb().select().from(schema.users).where(eq(schema.users.id, userId)).get() ?? null;
}

export async function setSession(userId: number) {
  (await cookies()).set(COOKIE, sessionValue(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}
