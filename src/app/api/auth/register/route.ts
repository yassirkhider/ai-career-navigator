import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users, auditLogs } from "@/lib/db/schema";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { startTrialForUser } from "@/lib/billing/subscription";

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(200),
  name: z.string().min(1).max(120).optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { email, password, name } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  const strengthError = validatePasswordStrength(password);
  if (strengthError) {
    return NextResponse.json({ error: strengthError }, { status: 400 });
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existing.length > 0) {
    // Deliberately generic message — do not reveal whether an email is registered.
    return NextResponse.json(
      { error: "Unable to create account with the provided details." },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);

  const [user] = await db
    .insert(users)
    .values({ email: normalizedEmail, passwordHash, name: name ?? null })
    .returning({ id: users.id, email: users.email, name: users.name });

  await db.insert(auditLogs).values({
    userId: user.id,
    action: "USER_REGISTERED",
    entityType: "user",
    entityId: user.id,
  });

  await startTrialForUser(user.id);

  await createSession(user.id);

  return NextResponse.json(
    { user: { id: user.id, email: user.email, name: user.name } },
    { status: 201 }
  );
}
