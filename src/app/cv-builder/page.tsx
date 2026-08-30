import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { requireActiveAccessPage } from "@/lib/billing/gate";
import { getFullCareerProfile } from "@/lib/career-profile/persist";
import { db } from "@/lib/db/client";
import { cvVersions, jobs } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { CvBuilder } from "@/components/CvBuilder";
import type { CvVersionContent } from "@/lib/ai/prompts/cvRewritePrompt";

export default async function CvBuilderPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await requireActiveAccessPage(user.id, user.role);

  const profile = await getFullCareerProfile(user.id);

  if (!profile) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900">CV Builder</h1>
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="text-slate-600">
            Build your Master Career Profile first so generated CVs are grounded in your
            actual experience.
          </p>
          <Link href="/dashboard" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
            Go upload a CV →
          </Link>
        </div>
      </main>
    );
  }

  const [versions, jobRows] = await Promise.all([
    db
      .select()
      .from(cvVersions)
      .where(eq(cvVersions.userId, user.id))
      .orderBy(desc(cvVersions.updatedAt)),
    db.select({ id: jobs.id, title: jobs.title }).from(jobs).where(eq(jobs.userId, user.id)),
  ]);

  const serializedVersions = versions.map((v) => ({
    ...v,
    content: v.content as CvVersionContent,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  }));

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">CV Builder</h1>
      <p className="mt-1 text-slate-600">
        Generate a version of your CV tailored to a specific job — or a general strengthening
        pass — without changing the underlying facts.
      </p>
      <div className="mt-6">
        <CvBuilder initialVersions={serializedVersions} jobOptions={jobRows} />
      </div>
    </main>
  );
}
