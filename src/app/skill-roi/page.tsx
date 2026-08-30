import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { requireActiveAccessPage } from "@/lib/billing/gate";
import { computeSkillRoiForUser } from "@/lib/skill-roi/compute";

const IMPACT_STYLES: Record<string, string> = {
  HIGH: "bg-green-100 text-green-800",
  MEDIUM: "bg-amber-100 text-amber-800",
  LOW: "bg-slate-100 text-slate-600",
};

const EFFORT_STYLES: Record<string, string> = {
  LOW: "bg-green-50 text-green-700",
  MEDIUM: "bg-amber-50 text-amber-700",
  HIGH: "bg-red-50 text-red-700",
  UNKNOWN: "bg-slate-50 text-slate-600",
};

export default async function SkillRoiPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await requireActiveAccessPage(user.id, user.role);

  const summary = await computeSkillRoiForUser(user.id);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Skill ROI</h1>
      <p className="mt-1 text-slate-600">
        Which skills show up most across the {summary.jobsAnalyzed} job
        {summary.jobsAnalyzed === 1 ? "" : "s"} you&apos;ve analyzed, and which are worth
        learning first — instead of guessing at random courses.
      </p>

      {summary.jobsAnalyzed < 2 ? (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="text-slate-600">
            Skill ROI needs at least a couple of analyzed jobs to spot recurring patterns —
            you have {summary.jobsAnalyzed} so far. Analyze a few more jobs to unlock this.
          </p>
          <Link href="/jobs" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
            Go to Jobs →
          </Link>
        </div>
      ) : (
        <>
          {summary.recommendedLearningOrder.length > 0 && (
            <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="font-semibold text-slate-900">Recommended learning order</h2>
              <p className="mt-1 text-sm text-slate-500">
                Ranked by demand frequency, how often it&apos;s mandatory, and how much effort
                it takes to close the gap.
              </p>
              <ol className="mt-3 space-y-2">
                {summary.recommendedLearningOrder.map((item) => (
                  <li key={item.rank} className="flex gap-3 rounded-md border border-slate-100 p-3">
                    <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                      {item.rank}
                    </span>
                    <div>
                      <p className="font-medium text-slate-900">{item.skillName}</p>
                      <p className="text-sm text-slate-600">{item.reason}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Skill demand across your target jobs</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                    <th className="py-2 pr-3">Skill</th>
                    <th className="py-2 pr-3">Demand</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Career impact</th>
                    <th className="py-2 pr-3">Effort</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.skills.map((s) => (
                    <tr key={s.skillName} className="border-b border-slate-100 align-top">
                      <td className="py-2 pr-3">
                        <p className="font-medium text-slate-800">{s.skillName}</p>
                        <p className="text-xs text-slate-400">
                          {s.mandatoryCount > 0 && `${s.mandatoryCount} mandatory`}
                          {s.mandatoryCount > 0 && s.preferredCount > 0 && " · "}
                          {s.preferredCount > 0 && `${s.preferredCount} preferred`}
                        </p>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 rounded-full bg-slate-100">
                            <div
                              className="h-2 rounded-full bg-blue-600"
                              style={{ width: `${s.demandFrequencyPct}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500">{s.demandFrequencyPct}%</span>
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        {s.currentlyPossessed ? (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                            Possessed
                          </span>
                        ) : (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">
                            Gap
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${IMPACT_STYLES[s.estimatedCareerImpact]}`}
                        >
                          {s.estimatedCareerImpact}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${EFFORT_STYLES[s.learningEffort]}`}
                        >
                          {s.learningEffort}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
