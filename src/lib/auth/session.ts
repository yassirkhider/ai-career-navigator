import "server-only";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sessions, users } from "@/lib/db/schema";
import { signSessionToken, verifySessionToken } from "./jwt";
import { createId } from "@paralleldrive/cuid2";

const SESSION_COOKIE_NAME = "acn_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export async function createSession(userId: string) {
  const sessionId = createId();
  const expires = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  const token = await signSessionToken({ sub: userId, sessionId }, SESSION_TTL_SECONDS);

  await db.insert(sessions).values({
    id: sessionId,
    sessionToken: token,
    userId,
    expires,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const payload = await verifySessionToken(token);
    if (payload) {
      await db.delete(sessions).where(eq(sessions.id, payload.sessionId));
    }
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  // Cross-check the session still exists server-side (revocation support)
  // and hasn't expired, and load the user in one round trip.
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      expires: sessions.expires,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, payload.sessionId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.expires.getTime() < Date.now()) return null;

  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

export { SESSION_COOKIE_NAME };
