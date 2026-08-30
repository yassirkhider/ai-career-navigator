import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/session";
import { requireActiveAccessApi } from "@/lib/billing/gate";
import { db } from "@/lib/db/client";
import { coverLetters, jobs, jobRequirements, auditLogs } from "@/lib/db/schema";
import { getFullCareerProfile } from "@/lib/career-profile/persist";
import { getAIProvider, AIProviderError } from "@/lib/ai";
import {
  buildCoverLetterPrompt,
  coverLetterSchema,
  coverLetterToneEnum,
  COVER_LETTER_NAME,
  COVER_LETTER_VERSION,
} from "@/lib/ai/prompts/coverLetterPrompt";
import { checkRateLimit } from "@/lib/rate-limit";

const createSchema = z.object({
  jobId: z.string().min(1),
  tone: coverLetterToneEnum.optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const gateResponse = await requireActiveAccessApi();
  if (gateResponse) return gateResponse;

  const rl = checkRateLimit(`cover-letter-create:${user.id}`, 15, 60_000);
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
  const { jobId, tone } = parsed.data;

  const candidateProfile = await getFullCareerProfile(user.id);
  if (!candidateProfile) {
    return NextResponse.json(
      { error: "Please build your Master Career Profile (upload a CV) before generating a cover letter." },
      { status: 409 }
    );
  }

  // IDOR protection: job must belong to the requesting user.
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, user.id)))
    .limit(1);
  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const reqs = await db.select().from(jobRequirements).where(eq(jobRequirements.jobId, jobId));
  const requirementsText = reqs
    .map((r) => `(${r.importance}, ${r.category}): ${r.rawText}`)
    .join("\n");

  try {
    const provider = getAIProvider();
    const { systemPrompt, userPrompt } = buildCoverLetterPrompt({
      candidateProfileJson: JSON.stringify(candidateProfile),
      jobTitle: job.title,
      company: job.company,
      jobRequirementsText: requirementsText || "(no specific requirements extracted)",
      tone: tone ?? "PROFESSIONAL",
    });

    const { data } = await provider.generateStructured({
      systemPrompt,
      userPrompt,
      schema: coverLetterSchema,
      promptName: COVER_LETTER_NAME,
      promptVersion: COVER_LETTER_VERSION,
      userId: user.id,
    });

    const [created] = await db
      .insert(coverLetters)
      .values({
        userId: user.id,
        jobId,
        tone: tone ?? "PROFESSIONAL",
        subject: data.subject,
        body: data.body,
        aiModel: provider.model,
        aiPromptVersion: COVER_LETTER_VERSION,
      })
      .returning();

    await db.insert(auditLogs).values({
      userId: user.id,
      action: "COVER_LETTER_GENERATED",
      entityType: "cover_letter",
      entityId: created.id,
    });

    return NextResponse.json({ coverLetter: created, aiProvider: provider.name }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof AIProviderError
        ? "AI cover letter service is currently unavailable. Please try again shortly."
        : "Failed to generate cover letter.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(coverLetters)
    .where(eq(coverLetters.userId, user.id))
    .orderBy(desc(coverLetters.updatedAt));

  return NextResponse.json({ coverLetters: rows });
}
