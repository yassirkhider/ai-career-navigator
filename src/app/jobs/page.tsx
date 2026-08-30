import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { requireActiveAccessPage } from "@/lib/billing/gate";
import { db } from "@/lib/db/client";
import { jobs } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { JobPasteForm } from "@/components/JobPasteForm";

export default async function JobsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await requireActiveAccessPage(user.id, user.role);

  const userJobs = await db
    .select()
    .from(jobs)
    .where(eq(jobs.userId, user.id))
    .orderBy(desc(jobs.createdAt));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Jobs</h1>
      <div className="mt-6">
        <JobPasteForm />
      </div>

      <div className="mt-8">
        <h2 className="font-semibold text-slate-900">Your jobs</h2>
        <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {userJobs.map((j) => (
            <li key={j.id} className="p-4">
              <Link href={`/jobs/${j.id}`} className="font-medium text-slate-800 hover:text-blue-600">
                {j.title}
              </Link>
              <div className="mt-1 text-xs text-slate-500">
                {j.company && <span>{j.company} · </span>}
                <span className="uppercase">{j.parseStatus}</span>
              </div>
            </li>
          ))}
          {userJobs.length === 0 && (
            <li className="p-4 text-sm text-slate-500">No jobs yet — paste one above.</li>
          )}
        </ul>
      </div>
    </main>
  );
}
