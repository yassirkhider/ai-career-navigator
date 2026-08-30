import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireActiveAccessPage } from "@/lib/billing/gate";
import { db } from "@/lib/db/client";
import { jobs, jobRequirements } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { JobFitAnalysis } from "@/components/JobFitAnalysis";
import { SimilarRoles } from "@/components/SimilarRoles";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await requireActiveAccessPage(user.id, user.role);

  const { jobId } = await params;

  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, user.id)))
    .limit(1);

  if (!job) notFound();

  const requirements = await db
    .select()
    .from(jobRequirements)
    .where(eq(jobRequirements.jobId, jobId));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">{job.title}</h1>
      {job.company && <p className="text-slate-600">{job.company}</p>}

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Extracted requirements</h2>
        <ul className="mt-3 space-y-2">
          {requirements.map((r) => (
            <li key={r.id} className="flex items-center justify-between text-sm">
              <span className="text-slate-700">{r.rawText}</span>
              <span className="flex gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {r.category.replace(/_/g, " ").toLowerCase()}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    r.importance === "MANDATORY"
                      ? "bg-red-50 text-red-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {r.importance.toLowerCase()}
                </span>
              </span>
            </li>
          ))}
          {requirements.length === 0 && (
            <p className="text-sm text-slate-500">No requirements extracted.</p>
          )}
        </ul>
      </section>

      <section className="mt-6">
        <JobFitAnalysis jobId={job.id} />
      </section>

      <section className="mt-6">
        <SimilarRoles jobId={job.id} />
      </section>
    </main>
  );
}
