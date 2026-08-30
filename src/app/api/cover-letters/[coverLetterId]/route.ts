import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { coverLetters, auditLogs } from "@/lib/db/schema";

const updateSchema = z.object({
  subject: z.string().min(1).max(255).optional(),
  body: z.string().min(1).max(10_000).optional(),
});

async function getOwnedLetter(id: string, userId: string) {
  const [row] = await db
    .select()
    .from(coverLetters)
    .where(and(eq(coverLetters.id, id), eq(coverLetters.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ coverLetterId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const { coverLetterId } = await context.params;
  const letter = await getOwnedLetter(coverLetterId, user.id);
  if (!letter) {
    return NextResponse.json({ error: "Cover letter not found." }, { status: 404 });
  }
  return NextResponse.json({ coverLetter: letter });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ coverLetterId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const { coverLetterId } = await context.params;

  const existing = await getOwnedLetter(coverLetterId, user.id);
  if (!existing) {
    return NextResponse.json({ error: "Cover letter not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const [updated] = await db
    .update(coverLetters)
    .set(parsed.data)
    .where(and(eq(coverLetters.id, coverLetterId), eq(coverLetters.userId, user.id)))
    .returning();

  return NextResponse.json({ coverLetter: updated });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ coverLetterId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const { coverLetterId } = await context.params;

  const existing = await getOwnedLetter(coverLetterId, user.id);
  if (!existing) {
    return NextResponse.json({ error: "Cover letter not found." }, { status: 404 });
  }

  await db
    .delete(coverLetters)
    .where(and(eq(coverLetters.id, coverLetterId), eq(coverLetters.userId, user.id)));

  await db.insert(auditLogs).values({
    userId: user.id,
    action: "COVER_LETTER_DELETED",
    entityType: "cover_letter",
    entityId: coverLetterId,
  });

  return NextResponse.json({ ok: true });
}
