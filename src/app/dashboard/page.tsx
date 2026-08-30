import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { requireActiveAccessPage } from "@/lib/billing/gate";
import { getFullCareerProfile } from "@/lib/career-profile/persist";
import { getGapSummaryForUser } from "@/lib/gaps/aggregate";
import { db } from "@/lib/db/client";
import { jobs } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { CvUploadWidget } from "@/components/CvUploadWidget";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await requireActiveAccessPage(user.id, user.role);

  const profile = await getFullCareerProfile(user.id);
  const gapSummary = await getGapSummaryForUser(user.id);
  const userJobs = await db
    .select()
    .from(jobs)
    .where(eq(jobs.userId, user.id))
    .orderBy(desc(jobs.createdAt))
    .limit(5);

  const completeness = computeProfileCompleteness(profile);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">
        Welcome{user.name ? `, ${user.name}` : ""}
      </h1>
      <p className="text-slate-600">Here&apos;s where your career development stands.</p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Profile completeness</h2>
          <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-blue-600"
              style={{ width: `${completeness}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-slate-500">{completeness}% complete</p>
          {!profile && (
            <p className="mt-3 text-sm text-slate-600">
              Upload a CV below to build your Master Career Profile.
            </p>
          )}
        </div>

        <CvUploadWidget />
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Skill gaps</h2>
          <Link href="/gaps" className="text-sm text-blue-600 hover:underline">
            View full breakdown →
          </Link>
        </div>
        {gapSummary.totalGaps === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No gaps identified yet — analyze a job&apos;s fit to see gaps here.
          </p>
        ) : (
          <p className="mt-3 text-sm text-slate-700">
            <span className="font-semibold">{gapSummary.totalGaps}</span> gap
            {gapSummary.totalGaps === 1 ? "" : "s"} identified across {gapSummary.jobsAnalyzed} analyzed job
            {gapSummary.jobsAnalyzed === 1 ? "" : "s"}
            {gapSummary.countsByGapType.BLOCKING ? (
              <span className="ml-1 font-medium text-red-700">
                ({gapSummary.countsByGapType.BLOCKING} blocking)
              </span>
            ) : null}
            .
          </p>
        )}
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Recent jobs</h2>
          <Link href="/jobs" className="text-sm text-blue-600 hover:underline">
            View all / add a job →
          </Link>
        </div>
        {userJobs.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No jobs analyzed yet. Paste a job description to get started.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {userJobs.map((j) => (
              <li key={j.id} className="py-2">
                <Link href={`/jobs/${j.id}`} className="text-sm font-medium text-slate-800 hover:text-blue-600">
                  {j.title}
                </Link>
                <span className="ml-2 text-xs text-slate-400">{j.parseStatus}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function computeProfileCompleteness(
  profile: Awaited<ReturnType<typeof getFullCareerProfile>>
): number {
  if (!profile) return 0;
  let score = 20; // has a profile row at all
  if (profile.profile.professionalSummary) score += 15;
  if (profile.workExperiences.length > 0) score += 25;
  if (profile.educations.length > 0) score += 15;
  if (profile.skills.length > 0) score += 25;
  return Math.min(100, score);
}
