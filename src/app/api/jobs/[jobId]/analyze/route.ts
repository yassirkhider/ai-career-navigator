import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/session";
import { requireActiveAccessApi } from "@/lib/billing/gate";
import { db } from "@/lib/db/client";
import { jobs, jobRequirements, jobAnalyses, requirementMatches, auditLogs } from "@/lib/db/schema";
import { getFullCareerProfile } from "@/lib/career-profile/persist";
import { getAIProvider, AIProviderError } from "@/lib/ai";
import {
  buildJobFitPrompt,
  jobFitSchema,
  JOB_FIT_NAME,
  JOB_FIT_VERSION,
} from "@/lib/ai/prompts/jobFitPrompt";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const gateResponse = await requireActiveAccessApi();
  if (gateResponse) return gateResponse;

  const { jobId } = await context.params;

  const rl = checkRateLimit(`job-analyze:${user.id}`, 15, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  // IDOR protection: job must belong to the requesting user.
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, user.id)))
    .limit(1);

  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  if (job.parseStatus !== "COMPLETED") {
    return NextResponse.json(
      { error: "Job must be successfully parsed before it can be analyzed." },
      { status: 409 }
    );
  }

  const requirements = await db
    .select()
    .from(jobRequirements)
    .where(eq(jobRequirements.jobId, jobId));

  if (requirements.length === 0) {
    return NextResponse.json(
      { error: "This job has no extracted requirements to analyze." },
      { status: 409 }
    );
  }

  const candidateProfile = await getFullCareerProfile(user.id);
  if (!candidateProfile) {
    return NextResponse.json(
      { error: "Please build your Master Career Profile (upload a CV) before analyzing job fit." },
      { status: 409 }
    );
  }

  const indexedRequirements = requirements.map((r, index) => ({
    index,
    rawText: r.rawText,
    category: r.category,
    importance: r.importance,
  }));

  try {
    const provider = getAIProvider();
    const { systemPrompt, userPrompt } = buildJobFitPrompt({
      candidateProfileJson: JSON.stringify(candidateProfile),
      requirements: indexedRequirements,
    });

    const { data } = await provider.generateStructured({
      systemPrompt,
      userPrompt,
      schema: jobFitSchema,
      promptName: JOB_FIT_NAME,
      promptVersion: JOB_FIT_VERSION,
      userId: user.id,
    });

    const analysis = await db.transaction(async (tx) => {
      const [createdAnalysis] = await tx
        .insert(jobAnalyses)
        .values({
          jobId,
          userId: user.id,
          overallScore: data.overallScore,
          mandatoryScore: data.categoryScores.mandatory,
          technicalSkillsScore: data.categoryScores.technicalSkills,
          experienceScore: data.categoryScores.experience,
          educationScore: data.categoryScores.education,
          certificationsScore: data.categoryScores.certifications,
          softSkillsScore: data.categoryScores.softSkills,
          toolsScore: data.categoryScores.tools,
          industryScore: data.categoryScores.industry,
          languagesScore: data.categoryScores.languages,
          locationScore: data.categoryScores.location,
          recommendation: data.recommendation,
          recommendationReason: data.recommendationReason,
          strengths: data.strengths,
          criticalGaps: data.criticalGaps,
          aiModel: provider.model,
          aiPromptVersion: JOB_FIT_VERSION,
          rawAiResponse: data,
        })
        .returning();

      for (const match of data.matches) {
        const requirement = requirements[match.requirementIndex];
        if (!requirement) continue; // defensive: ignore out-of-range indices from the model
        await tx.insert(requirementMatches).values({
          jobAnalysisId: createdAnalysis.id,
          jobRequirementId: requirement.id,
          matchStatus: match.matchStatus,
          confidence: match.confidence,
          gapType: match.gapType,
          candidateEvidence: match.candidateEvidence,
          recommendedAction: match.recommendedAction,
          priority: match.priority,
        });
      }

      return createdAnalysis;
    });

    await db.insert(auditLogs).values({
      userId: user.id,
      action: "JOB_ANALYZED",
      entityType: "job_analysis",
      entityId: analysis.id,
    });

    const matchesWithRequirementText = data.matches.map((m) => ({
      ...m,
      requirement: requirements[m.requirementIndex]
        ? {
            rawText: requirements[m.requirementIndex].rawText,
            category: requirements[m.requirementIndex].category,
            importance: requirements[m.requirementIndex].importance,
          }
        : null,
    }));

    return NextResponse.json({
      analysisId: analysis.id,
      overallScore: data.overallScore,
      categoryScores: data.categoryScores,
      recommendation: data.recommendation,
      recommendationReason: data.recommendationReason,
      strengths: data.strengths,
      criticalGaps: data.criticalGaps,
      matches: matchesWithRequirementText,
      aiProvider: provider.name,
    });
  } catch (err) {
    const message =
      err instanceof AIProviderError
        ? "AI analysis service is currently unavailable. Please try again shortly."
        : "Failed to generate job fit analysis.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
