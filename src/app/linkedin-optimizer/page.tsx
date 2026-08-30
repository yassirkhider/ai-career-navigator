import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { requireActiveAccessPage } from "@/lib/billing/gate";
import { getFullCareerProfile } from "@/lib/career-profile/persist";
import { db } from "@/lib/db/client";
import { linkedinOptimizations } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { LinkedinOptimizer } from "@/components/LinkedinOptimizer";
import type { LinkedinOptimizationResult } from "@/lib/ai/prompts/linkedinOptimizerPrompt";

export default async function LinkedinOptimizerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await requireActiveAccessPage(user.id, user.role);

  const profile = await getFullCareerProfile(user.id);

  const [latest] = await db
    .select()
    .from(linkedinOptimizations)
    .where(eq(linkedinOptimizations.userId, user.id))
    .orderBy(desc(linkedinOptimizations.createdAt))
    .limit(1);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">LinkedIn Optimizer</h1>
      <p className="mt-1 text-slate-600">
        AI-suggested headline, About section, and keywords based on your actual profile.
      </p>

      {!profile ? (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="text-slate-600">
            Build your Master Career Profile first so suggestions are grounded in your actual
            experience.
          </p>
          <Link href="/dashboard" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
            Go upload a CV →
          </Link>
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <LinkedinOptimizer
            initialContent={(latest?.content as LinkedinOptimizationResult) ?? null}
            initialCreatedAt={latest?.createdAt ? latest.createdAt.toISOString() : null}
            aiModelIsMock={latest?.aiModel?.includes("mock") ?? false}
          />
        </div>
      )}
    </main>
  );
}
