import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  jobs,
  jobAnalyses,
  requirementMatches,
  jobRequirements,
} from "@/lib/db/schema";

export interface AnalyzedRequirement {
  jobId: string;
  jobTitle: string;
  analyzedAt: Date;
  rawText: string;
  category: string;
  importance: "MANDATORY" | "PREFERRED";
  matchStatus: string | null;
  gapType: string | null;
  priority: string | null;
  recommendedAction: string | null;
  candidateEvidence: string | null;
  confidence: string | null;
}

/**
 * For every job the requesting user owns, returns EVERY extracted
 * requirement (not just gaps) joined with the match result from that job's
 * MOST RECENT analysis, if one exists. Used by both the Gap Analysis view
 * (which filters to non-matches) and the Skill ROI engine (which needs the
 * full requirement set, matched or not, to compute demand frequency).
 */
export async function getAnalyzedRequirementsForUser(
  userId: string
): Promise<{ jobsWithAnalysis: number; totalJobs: number; requirements: AnalyzedRequirement[] }> {
  const userJobs = await db.select().from(jobs).where(eq(jobs.userId, userId));

  const requirements: AnalyzedRequirement[] = [];
  let jobsWithAnalysis = 0;

  for (const job of userJobs) {
    const jobRequirementRows = await db
      .select()
      .from(jobRequirements)
      .where(eq(jobRequirements.jobId, job.id));

    const [latestAnalysis] = await db
      .select()
      .from(jobAnalyses)
      .where(and(eq(jobAnalyses.jobId, job.id), eq(jobAnalyses.userId, userId)))
      .orderBy(desc(jobAnalyses.createdAt))
      .limit(1);

    const matchesByRequirementId = new Map<
      string,
      {
        matchStatus: string;
        gapType: string | null;
        priority: string | null;
        recommendedAction: string | null;
        candidateEvidence: string | null;
        confidence: string;
      }
    >();

    if (latestAnalysis) {
      jobsWithAnalysis += 1;
      const matches = await db
        .select()
        .from(requirementMatches)
        .where(eq(requirementMatches.jobAnalysisId, latestAnalysis.id));
      for (const m of matches) {
        matchesByRequirementId.set(m.jobRequirementId, m);
      }
    }

    for (const req of jobRequirementRows) {
      const match = matchesByRequirementId.get(req.id);
      requirements.push({
        jobId: job.id,
        jobTitle: job.title,
        analyzedAt: latestAnalysis?.createdAt ?? job.createdAt,
        rawText: req.rawText,
        category: req.category,
        importance: req.importance,
        matchStatus: match?.matchStatus ?? null,
        gapType: match?.gapType ?? null,
        priority: match?.priority ?? null,
        recommendedAction: match?.recommendedAction ?? null,
        candidateEvidence: match?.candidateEvidence ?? null,
        confidence: match?.confidence ?? null,
      });
    }
  }

  return { jobsWithAnalysis, totalJobs: userJobs.length, requirements };
}
