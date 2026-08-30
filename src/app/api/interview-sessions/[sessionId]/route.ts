import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { interviewSessions, interviewQuestions, interviewAnswers, jobs } from "@/lib/db/schema";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const { sessionId } = await context.params;

  const [session] = await db
    .select({
      id: interviewSessions.id,
      jobId: interviewSessions.jobId,
      jobTitle: jobs.title,
      createdAt: interviewSessions.createdAt,
    })
    .from(interviewSessions)
    .innerJoin(jobs, eq(interviewSessions.jobId, jobs.id))
    .where(and(eq(interviewSessions.id, sessionId), eq(interviewSessions.userId, user.id)))
    .limit(1);

  if (!session) {
    return NextResponse.json({ error: "Interview session not found." }, { status: 404 });
  }

  const questions = await db
    .select()
    .from(interviewQuestions)
    .where(eq(interviewQuestions.sessionId, sessionId))
    .orderBy(interviewQuestions.orderIndex);

  const questionsWithAnswers = await Promise.all(
    questions.map(async (q) => {
      const [latestAnswer] = await db
        .select()
        .from(interviewAnswers)
        .where(eq(interviewAnswers.questionId, q.id))
        .orderBy(desc(interviewAnswers.createdAt))
        .limit(1);
      return { ...q, latestAnswer: latestAnswer ?? null };
    })
  );

  return NextResponse.json({ session, questions: questionsWithAnswers });
}
