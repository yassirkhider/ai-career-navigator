import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { requireActiveAccessPage } from "@/lib/billing/gate";
import { computeSkillRoiForUser } from "@/lib/skill-roi/compute";
import { db } from "@/lib/db/client";
import { courseRecommendationBatches } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { LearningEngine } from "@/components/LearningEngine";
import type { CourseSuggestion } from "@/lib/learning/types";

export default async function LearningPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await requireActiveAccessPage(user.id, user.role);

  const [roi, batches] = await Promise.all([
    computeSkillRoiForUser(user.id),
    db
      .select()
      .from(courseRecommendationBatches)
      .where(eq(courseRecommendationBatches.userId, user.id))
      .orderBy(desc(courseRecommendationBatches.createdAt)),
  ]);

  const recommendedSkills = roi.recommendedLearningOrder.map((r) => ({
    skillName: r.skillName,
    reason: r.reason,
  }));

  const serializedBatches = batches.map((b) => ({
    ...b,
    recommendations: b.recommendations as CourseSuggestion[],
    createdAt: b.createdAt.toISOString(),
  }));

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Learning</h1>
      <p className="mt-1 text-slate-600">
        Course recommendations targeted at your highest-priority skill gaps.
      </p>

      {roi.jobsAnalyzed < 2 && recommendedSkills.length === 0 ? (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="text-slate-600">
            Analyze a couple of jobs first so the Skill ROI engine can identify your
            highest-priority gaps.
          </p>
          <Link href="/skill-roi" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
            Go to Skill ROI →
          </Link>
        </div>
      ) : (
        <div className="mt-6">
          <LearningEngine recommendedSkills={recommendedSkills} initialBatches={serializedBatches} />
        </div>
      )}
    </main>
  );
}
