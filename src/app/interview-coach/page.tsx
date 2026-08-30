import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { requireActiveAccessPage } from "@/lib/billing/gate";
import { getFullCareerProfile } from "@/lib/career-profile/persist";
import { db } from "@/lib/db/client";
import { interviewSessions, jobs } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { StartInterviewSession } from "@/components/StartInterviewSession";

export default async function InterviewCoachPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await requireActiveAccessPage(user.id, user.role);

  const profile = await getFullCareerProfile(user.id);

  if (!profile) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900">Interview Coach</h1>
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="text-slate-600">
            Build your Master Career Profile first so interview prep is grounded in your
            actual experience.
          </p>
          <Link href="/dashboard" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
            Go upload a CV →
          </Link>
        </div>
      </main>
    );
  }

  const [sessions, jobRows] = await Promise.all([
    db
      .select({
        id: interviewSessions.id,
        jobId: interviewSessions.jobId,
        jobTitle: jobs.title,
        createdAt: interviewSessions.createdAt,
      })
      .from(interviewSessions)
      .innerJoin(jobs, eq(interviewSessions.jobId, jobs.id))
      .where(eq(interviewSessions.userId, user.id))
      .orderBy(desc(interviewSessions.createdAt)),
    db.select({ id: jobs.id, title: jobs.title }).from(jobs).where(eq(jobs.userId, user.id)),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Interview Coach</h1>
      <p className="mt-1 text-slate-600">
        Practice with role-specific questions and get honest, evidence-based feedback.
      </p>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <StartInterviewSession jobOptions={jobRows} />
      </div>

      <div className="mt-6">
        <h2 className="font-semibold text-slate-900">Past sessions</h2>
        <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {sessions.map((s) => (
            <li key={s.id} className="p-3">
              <Link href={`/interview-coach/${s.id}`} className="font-medium text-slate-800 hover:text-blue-600">
                {s.jobTitle}
              </Link>
              <span className="ml-2 text-xs text-slate-400">
                {new Date(s.createdAt).toLocaleDateString()}
              </span>
            </li>
          ))}
          {sessions.length === 0 && (
            <li className="p-4 text-sm text-slate-500">No sessions yet.</li>
          )}
        </ul>
      </div>
    </main>
  );
}
