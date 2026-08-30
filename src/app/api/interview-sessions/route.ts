import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/session";
import { requireActiveAccessApi } from "@/lib/billing/gate";
import { db } from "@/lib/db/client";
import {
  interviewSessions,
  interviewQuestions,
  jobs,
  jobRequirements,
  auditLogs,
} from "@/lib/db/schema";
import { getFullCareerProfile } from "@/lib/career-profile/persist";
import { getGapSummaryForUser } from "@/lib/gaps/aggregate";
import { getAIProvider, AIProviderError } from "@/lib/ai";
import {
  buildInterviewQuestionsPrompt,
  interviewQuestionsSchema,
  INTERVIEW_QUESTIONS_NAME,
  INTERVIEW_QUESTIONS_VERSION,
} from "@/lib/ai/prompts/interviewQuestionsPrompt";
import { checkRateLimit } from "@/lib/rate-limit";

const createSchema = z.object({
  jobId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const gateResponse = await requireActiveAccessApi();
  if (gateResponse) return gateResponse;

  const rl = checkRateLimit(`interview-session-create:${user.id}`, 10, 60_000);
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
    return NextResponse.json({ error: "A jobId is required." }, { status: 400 });
  }
  const { jobId } = parsed.data;

  const candidateProfile = await getFullCareerProfile(user.id);
  if (!candidateProfile) {
    return NextResponse.json(
      { error: "Please build your Master Career Profile (upload a CV) before starting interview prep." },
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

  // Gap context is optional — only include gaps specific to this job.
  const gapSummary = await getGapSummaryForUser(user.id);
  const jobGaps = gapSummary.gaps.filter((g) => g.jobId === jobId);
  const gapSummaryText =
    jobGaps.length > 0
      ? jobGaps.map((g) => `${g.requirementText} (${g.gapType ?? "gap"}): ${g.recommendedAction ?? ""}`).join("\n")
      : null;

  try {
    const provider = getAIProvider();
    const { systemPrompt, userPrompt } = buildInterviewQuestionsPrompt({
      candidateProfileJson: JSON.stringify(candidateProfile),
      jobTitle: job.title,
      jobRequirementsText: requirementsText || "(no specific requirements extracted)",
      gapSummaryText,
    });

    const { data } = await provider.generateStructured({
      systemPrompt,
      userPrompt,
      schema: interviewQuestionsSchema,
      promptName: INTERVIEW_QUESTIONS_NAME,
      promptVersion: INTERVIEW_QUESTIONS_VERSION,
      userId: user.id,
    });

    const session = await db.transaction(async (tx) => {
      const [createdSession] = await tx
        .insert(interviewSessions)
        .values({
          userId: user.id,
          jobId,
          aiModel: provider.model,
          aiPromptVersion: INTERVIEW_QUESTIONS_VERSION,
        })
        .returning();

      const questionRows = await tx
        .insert(interviewQuestions)
        .values(
          data.questions.map((q, i) => ({
            sessionId: createdSession.id,
            questionText: q.text,
            questionType: q.type,
            orderIndex: i,
          }))
        )
        .returning();

      return { ...createdSession, questions: questionRows };
    });

    await db.insert(auditLogs).values({
      userId: user.id,
      action: "INTERVIEW_SESSION_CREATED",
      entityType: "interview_session",
      entityId: session.id,
    });

    return NextResponse.json({ session, aiProvider: provider.name }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof AIProviderError
        ? "AI interview coach service is currently unavailable. Please try again shortly."
        : "Failed to generate interview questions.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const sessions = await db
    .select({
      id: interviewSessions.id,
      jobId: interviewSessions.jobId,
      jobTitle: jobs.title,
      createdAt: interviewSessions.createdAt,
    })
    .from(interviewSessions)
    .innerJoin(jobs, eq(interviewSessions.jobId, jobs.id))
    .where(eq(interviewSessions.userId, user.id))
    .orderBy(desc(interviewSessions.createdAt));

  return NextResponse.json({ sessions });
}
