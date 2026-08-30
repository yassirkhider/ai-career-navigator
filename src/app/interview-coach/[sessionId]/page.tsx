import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireActiveAccessPage } from "@/lib/billing/gate";
import { db } from "@/lib/db/client";
import { interviewSessions, interviewQuestions, interviewAnswers, jobs } from "@/lib/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { InterviewPractice } from "@/components/InterviewPractice";

export default async function InterviewSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await requireActiveAccessPage(user.id, user.role);

  const { sessionId } = await params;

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

  if (!session) notFound();

  const questionRows = await db
    .select()
    .from(interviewQuestions)
    .where(eq(interviewQuestions.sessionId, sessionId))
    .orderBy(interviewQuestions.orderIndex);

  const questions = await Promise.all(
    questionRows.map(async (q) => {
      const [latestAnswer] = await db
        .select()
        .from(interviewAnswers)
        .where(eq(interviewAnswers.questionId, q.id))
        .orderBy(desc(interviewAnswers.createdAt))
        .limit(1);
      return { ...q, latestAnswer: latestAnswer ?? null };
    })
  );

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">{session.jobTitle}</h1>
      <p className="text-slate-600">Interview prep session · {questions.length} questions</p>

      <InterviewPractice sessionId={session.id} initialQuestions={questions} />
    </main>
  );
}
