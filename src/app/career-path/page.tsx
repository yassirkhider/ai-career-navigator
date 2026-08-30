import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { requireActiveAccessPage } from "@/lib/billing/gate";
import { getFullCareerProfile } from "@/lib/career-profile/persist";
import { db } from "@/lib/db/client";
import { careerPathPredictions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { CareerPathExplorer } from "@/components/CareerPathExplorer";
import type { CareerPathOption } from "@/lib/ai/prompts/careerPathPrompt";

export default async function CareerPathPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await requireActiveAccessPage(user.id, user.role);

  const profile = await getFullCareerProfile(user.id);

  const [latest] = await db
    .select()
    .from(careerPathPredictions)
    .where(eq(careerPathPredictions.userId, user.id))
    .orderBy(desc(careerPathPredictions.createdAt))
    .limit(1);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Career Path Prediction</h1>
      <p className="mt-1 text-slate-600">
        Realistic next-career options based on your Master Career Profile — not guarantees,
        just an honest read on what&apos;s within reach and what it would take.
      </p>

      {!profile ? (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="text-slate-600">
            Build your Master Career Profile first so predictions can be grounded in your
            actual experience.
          </p>
          <Link href="/dashboard" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
            Go upload a CV →
          </Link>
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <CareerPathExplorer
            initialPaths={(latest?.paths as CareerPathOption[]) ?? null}
            initialCreatedAt={latest?.createdAt ? latest.createdAt.toISOString() : null}
            aiProviderIsMock={latest?.aiModel?.includes("mock") ?? false}
          />
        </div>
      )}
    </main>
  );
}
