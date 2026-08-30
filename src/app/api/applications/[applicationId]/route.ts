import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { applications, auditLogs } from "@/lib/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";

const APPLICATION_STATUSES = [
  "SAVED",
  "PREPARING",
  "READY_TO_APPLY",
  "APPLIED",
  "RECRUITER_CONTACT",
  "INTERVIEW",
  "ASSESSMENT",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
  "ACCEPTED",
] as const;

const updateSchema = z.object({
  status: z.enum(APPLICATION_STATUSES).optional(),
  jobTitle: z.string().min(1).max(255).optional(),
  company: z.string().max(255).nullable().optional(),
  cvVersionLabel: z.string().max(255).nullable().optional(),
  coverLetterNotes: z.string().max(5000).nullable().optional(),
  dateApplied: z.string().datetime().nullable().optional(),
  contactName: z.string().max(255).nullable().optional(),
  contactEmail: z.preprocess(
    (v) => (v === "" ? null : v),
    z.string().email().max(255).nullable().optional()
  ),
  interviewDate: z.string().datetime().nullable().optional(),
  followUpDate: z.string().datetime().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  outcome: z.string().max(2000).nullable().optional(),
});

async function getOwnedApplication(applicationId: string, userId: string) {
  const [row] = await db
    .select()
    .from(applications)
    .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ applicationId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const rl = checkRateLimit(`application-update:${user.id}`, 60, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  const { applicationId } = await context.params;

  const existing = await getOwnedApplication(applicationId, user.id);
  if (!existing) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updates = parsed.data;
  const setValues: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    if (key === "dateApplied" || key === "interviewDate" || key === "followUpDate") {
      setValues[key] = value === null ? null : new Date(value as string);
    } else {
      setValues[key] = value;
    }
  }

  if (Object.keys(setValues).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const [updated] = await db
    .update(applications)
    .set(setValues)
    .where(and(eq(applications.id, applicationId), eq(applications.userId, user.id)))
    .returning();

  if (updates.status && updates.status !== existing.status) {
    await db.insert(auditLogs).values({
      userId: user.id,
      action: "APPLICATION_STATUS_CHANGED",
      entityType: "application",
      entityId: applicationId,
      metadata: { from: existing.status, to: updates.status },
    });
  }

  return NextResponse.json({ application: updated });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ applicationId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { applicationId } = await context.params;

  const existing = await getOwnedApplication(applicationId, user.id);
  if (!existing) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  await db
    .delete(applications)
    .where(and(eq(applications.id, applicationId), eq(applications.userId, user.id)));

  await db.insert(auditLogs).values({
    userId: user.id,
    action: "APPLICATION_DELETED",
    entityType: "application",
    entityId: applicationId,
  });

  return NextResponse.json({ ok: true });
}
