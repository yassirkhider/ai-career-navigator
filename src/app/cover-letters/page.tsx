import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { requireActiveAccessPage } from "@/lib/billing/gate";
import { getFullCareerProfile } from "@/lib/career-profile/persist";
import { db } from "@/lib/db/client";
import { coverLetters, jobs } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { CoverLetterBuilder } from "@/components/CoverLetterBuilder";

export default async function CoverLettersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await requireActiveAccessPage(user.id, user.role);

  const profile = await getFullCareerProfile(user.id);

  if (!profile) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900">Cover Letters</h1>
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="text-slate-600">
            Build your Master Career Profile first so cover letters are grounded in your
            actual experience.
          </p>
          <Link href="/dashboard" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
            Go upload a CV →
          </Link>
        </div>
      </main>
    );
  }

  const [letters, jobRows] = await Promise.all([
    db
      .select()
      .from(coverLetters)
      .where(eq(coverLetters.userId, user.id))
      .orderBy(desc(coverLetters.updatedAt)),
    db.select({ id: jobs.id, title: jobs.title }).from(jobs).where(eq(jobs.userId, user.id)),
  ]);

  const serialized = letters.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() }));

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Cover Letters</h1>
      <p className="mt-1 text-slate-600">
        Generate a tailored cover letter for a specific job, in the tone you want.
      </p>
      <div className="mt-6">
        <CoverLetterBuilder initialLetters={serialized} jobOptions={jobRows} />
      </div>
    </main>
  );
}
