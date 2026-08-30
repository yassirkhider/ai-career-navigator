import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/session";
import { requireActiveAccessApi } from "@/lib/billing/gate";
import { db } from "@/lib/db/client";
import {
  interviewSessions,
  interviewQuestions,
  interviewAnswers,
  auditLogs,
} from "@/lib/db/schema";
import { getFullCareerProfile } from "@/lib/career-profile/persist";
import { getAIProvider, AIProviderError } from "@/lib/ai";
import {
  buildInterviewScoringPrompt,
  interviewScoringSchema,
  INTERVIEW_SCORING_NAME,
  INTERVIEW_SCORING_VERSION,
} from "@/lib/ai/prompts/interviewScoringPrompt";
import { checkRateLimit } from "@/lib/rate-limit";

const answerSchema = z.object({
  questionId: z.string().min(1),
  answerText: z.string().min(1).max(10_000),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const gateResponse = await requireActiveAccessApi();
  if (gateResponse) return gateResponse;

  const rl = checkRateLimit(`interview-answer:${user.id}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  const { sessionId } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = answerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { questionId, answerText } = parsed.data;

  // IDOR protection: session must belong to the user, and the question must
  // actually belong to that session (prevents cross-session question IDs).
  const [session] = await db
    .select()
    .from(interviewSessions)
    .where(and(eq(interviewSessions.id, sessionId), eq(interviewSessions.userId, user.id)))
    .limit(1);
  if (!session) {
    return NextResponse.json({ error: "Interview session not found." }, { status: 404 });
  }

  const [question] = await db
    .select()
    .from(interviewQuestions)
    .where(and(eq(interviewQuestions.id, questionId), eq(interviewQuestions.sessionId, sessionId)))
    .limit(1);
  if (!question) {
    return NextResponse.json({ error: "Question not found in this session." }, { status: 404 });
  }

  const candidateProfile = await getFullCareerProfile(user.id);
  if (!candidateProfile) {
    return NextResponse.json({ error: "Master Career Profile not found." }, { status: 409 });
  }

  try {
    const provider = getAIProvider();
    const { systemPrompt, userPrompt } = buildInterviewScoringPrompt({
      questionText: question.questionText,
      answerText,
      candidateProfileJson: JSON.stringify(candidateProfile),
    });

    const { data } = await provider.generateStructured({
      systemPrompt,
      userPrompt,
      schema: interviewScoringSchema,
      promptName: INTERVIEW_SCORING_NAME,
      promptVersion: INTERVIEW_SCORING_VERSION,
      userId: user.id,
    });

    const [created] = await db
      .insert(interviewAnswers)
      .values({
        questionId,
        userId: user.id,
        answerText,
        relevanceScore: data.relevanceScore,
        technicalAccuracyScore: data.technicalAccuracyScore,
        structureScore: data.structureScore,
        evidenceScore: data.evidenceScore,
        clarityScore: data.clarityScore,
        completenessScore: data.completenessScore,
        overallScore: data.overallScore,
        feedback: data.feedback,
        improvedAnswerGuidance: data.improvedAnswerGuidance,
        aiModel: provider.model,
        aiPromptVersion: INTERVIEW_SCORING_VERSION,
      })
      .returning();

    await db.insert(auditLogs).values({
      userId: user.id,
      action: "INTERVIEW_ANSWER_SCORED",
      entityType: "interview_answer",
      entityId: created.id,
    });

    return NextResponse.json({ answer: created, aiProvider: provider.name }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof AIProviderError
        ? "AI interview coach service is currently unavailable. Please try again shortly."
        : "Failed to score answer.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
