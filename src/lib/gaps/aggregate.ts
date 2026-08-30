import "server-only";
import { getAnalyzedRequirementsForUser } from "@/lib/analysis/latest";

export interface GapItem {
  jobId: string;
  jobTitle: string;
  requirementText: string;
  category: string;
  importance: "MANDATORY" | "PREFERRED";
  matchStatus: string;
  gapType: string | null;
  confidence: string;
  priority: string | null;
  recommendedAction: string | null;
  candidateEvidence: string | null;
  analyzedAt: Date;
}

const NON_GAP_STATUSES = new Set(["STRONG_MATCH", "MATCH"]);

const PRIORITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

/**
 * For every job the user has analyzed, take only the MOST RECENT analysis
 * (a job may be re-analyzed after a CV update — stale gap data from an old
 * analysis should not be shown as current). Aggregate every match that is
 * not a full match into a classified, prioritized gap list.
 */
export async function getGapSummaryForUser(userId: string) {
  const { jobsWithAnalysis, requirements } = await getAnalyzedRequirementsForUser(userId);

  const gaps: GapItem[] = requirements
    .filter((r) => r.matchStatus !== null && !NON_GAP_STATUSES.has(r.matchStatus))
    .map((r) => ({
      jobId: r.jobId,
      jobTitle: r.jobTitle,
      requirementText: r.rawText,
      category: r.category,
      importance: r.importance,
      matchStatus: r.matchStatus as string,
      gapType: r.gapType,
      confidence: r.confidence ?? "LOW",
      priority: r.priority,
      recommendedAction: r.recommendedAction,
      candidateEvidence: r.candidateEvidence,
      analyzedAt: r.analyzedAt,
    }));

  gaps.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority ?? "LOW"] ?? 3;
    const pb = PRIORITY_ORDER[b.priority ?? "LOW"] ?? 3;
    if (pa !== pb) return pa - pb;
    if (a.importance !== b.importance) return a.importance === "MANDATORY" ? -1 : 1;
    return 0;
  });

  const countsByGapType: Record<string, number> = {};
  for (const g of gaps) {
    const key = g.gapType ?? "UNCLASSIFIED";
    countsByGapType[key] = (countsByGapType[key] ?? 0) + 1;
  }

  return {
    jobsAnalyzed: jobsWithAnalysis,
    totalGaps: gaps.length,
    countsByGapType,
    gaps,
  };
}
