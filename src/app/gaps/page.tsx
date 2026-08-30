import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { requireActiveAccessPage } from "@/lib/billing/gate";
import { getGapSummaryForUser } from "@/lib/gaps/aggregate";

const GAP_TYPE_LABELS: Record<string, { label: string; description: string; color: string }> = {
  BLOCKING: {
    label: "Blocking",
    description: "Mandatory licence, certification, degree, or authorization — cannot be worked around quickly.",
    color: "bg-red-50 text-red-700 border-red-200",
  },
  IMPORTANT_TRAINABLE: {
    label: "Important — Trainable",
    description: "A skill, tool, or methodology you can learn via a course.",
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
  PREFERRED: {
    label: "Preferred (optional)",
    description: "Nice-to-have — not essential to apply.",
    color: "bg-slate-50 text-slate-600 border-slate-200",
  },
  CV_VISIBILITY: {
    label: "CV Visibility Gap",
    description: "You likely have this — it's just not clearly shown on your CV.",
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  EXPERIENCE: {
    label: "Experience Gap",
    description: "Requires real professional experience — not solvable by a short course.",
    color: "bg-purple-50 text-purple-700 border-purple-200",
  },
  INFORMATION: {
    label: "Information Gap",
    description: "Not enough data in your profile to judge this one way or the other.",
    color: "bg-slate-50 text-slate-600 border-slate-200",
  },
  UNCLASSIFIED: {
    label: "Unclassified",
    description: "Flagged as a gap without a specific classification.",
    color: "bg-slate-50 text-slate-600 border-slate-200",
  },
};

const PRIORITY_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-800",
  HIGH: "bg-amber-100 text-amber-800",
  MEDIUM: "bg-blue-100 text-blue-800",
  LOW: "bg-slate-100 text-slate-600",
};

export default async function GapsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await requireActiveAccessPage(user.id, user.role);

  const summary = await getGapSummaryForUser(user.id);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Skill Gaps</h1>
      <p className="mt-1 text-slate-600">
        Aggregated from the latest analysis of each job you&apos;ve reviewed
        ({summary.jobsAnalyzed} job{summary.jobsAnalyzed === 1 ? "" : "s"} analyzed).
      </p>

      {summary.totalGaps === 0 ? (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="text-slate-600">
            No gaps found yet. Analyze a job&apos;s fit from its detail page to see
            classified gaps and a prioritized action plan here.
          </p>
          <Link href="/jobs" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
            Go to Jobs →
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Object.entries(summary.countsByGapType).map(([type, count]) => {
              const meta = GAP_TYPE_LABELS[type] ?? GAP_TYPE_LABELS.UNCLASSIFIED;
              return (
                <div key={type} className={`rounded-lg border p-3 ${meta.color}`}>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs font-medium">{meta.label}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-8">
            <h2 className="font-semibold text-slate-900">Prioritized action plan</h2>
            <p className="mt-1 text-sm text-slate-500">
              Sorted by priority, then by whether the requirement was mandatory.
            </p>
            <div className="mt-3 space-y-3">
              {summary.gaps.map((g, i) => {
                const meta = GAP_TYPE_LABELS[g.gapType ?? "UNCLASSIFIED"] ?? GAP_TYPE_LABELS.UNCLASSIFIED;
                return (
                  <div key={i} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">{g.requirementText}</span>
                      {g.priority && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[g.priority] ?? ""}`}>
                          {g.priority}
                        </span>
                      )}
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${meta.color}`}>
                        {meta.label}
                      </span>
                      {g.importance === "MANDATORY" && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">
                          mandatory
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{meta.description}</p>
                    <div className="mt-2 text-sm text-slate-700">
                      <span className="font-medium">Recommended action: </span>
                      {g.recommendedAction ?? "No action recommended."}
                    </div>
                    <Link
                      href={`/jobs/${g.jobId}`}
                      className="mt-2 inline-block text-xs text-blue-600 hover:underline"
                    >
                      From: {g.jobTitle} →
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
