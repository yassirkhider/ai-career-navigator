import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { applications, jobs, auditLogs } from "@/lib/db/schema";
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

const createSchema = z.object({
  jobId: z.string().nullable().optional(),
  jobTitle: z.string().min(1).max(255),
  company: z.string().max(255).nullable().optional(),
  status: z.enum(APPLICATION_STATUSES).optional(),
  notes: z.string().max(5000).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const rl = checkRateLimit(`application-create:${user.id}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { jobId, jobTitle, company, status, notes } = parsed.data;

  // IDOR protection: if linking to a job, it must belong to this user.
  if (jobId) {
    const [job] = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.userId, user.id)))
      .limit(1);
    if (!job) {
      return NextResponse.json({ error: "Linked job not found." }, { status: 404 });
    }
  }

  const [created] = await db
    .insert(applications)
    .values({
      userId: user.id,
      jobId: jobId ?? null,
      jobTitle,
      company: company ?? null,
      status: status ?? "SAVED",
      notes: notes ?? null,
    })
    .returning();

  await db.insert(auditLogs).values({
    userId: user.id,
    action: "APPLICATION_CREATED",
    entityType: "application",
    entityId: created.id,
  });

  return NextResponse.json({ application: created }, { status: 201 });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(applications)
    .where(eq(applications.userId, user.id))
    .orderBy(desc(applications.updatedAt));

  return NextResponse.json({ applications: rows });
}
