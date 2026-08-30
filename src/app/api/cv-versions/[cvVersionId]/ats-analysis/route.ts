import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/session";
import { requireActiveAccessApi } from "@/lib/billing/gate";
import { db } from "@/lib/db/client";
import { cvVersions, jobs, jobRequirements, atsAnalyses, auditLogs } from "@/lib/db/schema";
import { getAIProvider, AIProviderError } from "@/lib/ai";
import {
  buildAtsAnalysisPrompt,
  atsAnalysisSchema,
  ATS_ANALYSIS_NAME,
  ATS_ANALYSIS_VERSION,
} from "@/lib/ai/prompts/atsAnalysisPrompt";
import { checkRateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  jobId: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ cvVersionId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const gateResponse = await requireActiveAccessApi();
  if (gateResponse) return gateResponse;

  const rl = checkRateLimit(`ats-analysis:${user.id}`, 15, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  const { cvVersionId } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A jobId is required for ATS analysis." }, { status: 400 });
  }
  const { jobId } = parsed.data;

  // IDOR protection on both the CV version and the job.
  const [cvVersion] = await db
    .select()
    .from(cvVersions)
    .where(and(eq(cvVersions.id, cvVersionId), eq(cvVersions.userId, user.id)))
    .limit(1);
  if (!cvVersion) {
    return NextResponse.json({ error: "CV version not found." }, { status: 404 });
  }

  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, user.id)))
    .limit(1);
  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const reqs = await db.select().from(jobRequirements).where(eq(jobRequirements.jobId, jobId));
  if (reqs.length === 0) {
    return NextResponse.json(
      { error: "This job has no extracted requirements to check against." },
      { status: 409 }
    );
  }
  const requirementsText = reqs.map((r) => `(${r.importance}, ${r.category}): ${r.rawText}`).join("\n");

  try {
    const provider = getAIProvider();
    const { systemPrompt, userPrompt } = buildAtsAnalysisPrompt({
      cvContentJson: JSON.stringify(cvVersion.content),
      jobRequirementsText: requirementsText,
    });

    const { data } = await provider.generateStructured({
      systemPrompt,
      userPrompt,
      schema: atsAnalysisSchema,
      promptName: ATS_ANALYSIS_NAME,
      promptVersion: ATS_ANALYSIS_VERSION,
      userId: user.id,
    });

    const [created] = await db
      .insert(atsAnalyses)
      .values({
        userId: user.id,
        cvVersionId,
        jobId,
        overallScore: data.overallScore,
        keywordAlignmentScore: data.keywordAlignmentScore,
        skillCoverageScore: data.skillCoverageScore,
        readabilityScore: data.readabilityScore,
        structureScore: data.structureScore,
        experienceRelevanceScore: data.experienceRelevanceScore,
        measurableAchievementsScore: data.measurableAchievementsScore,
        matchedKeywords: data.matchedKeywords,
        missingKeywords: data.missingKeywords,
        potentialIssues: data.potentialIssues,
        suggestions: data.suggestions,
        aiModel: provider.model,
        aiPromptVersion: ATS_ANALYSIS_VERSION,
      })
      .returning();

    await db.insert(auditLogs).values({
      userId: user.id,
      action: "ATS_ANALYSIS_GENERATED",
      entityType: "ats_analysis",
      entityId: created.id,
    });

    return NextResponse.json({ atsAnalysis: created, aiProvider: provider.name }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof AIProviderError
        ? "AI ATS analysis service is currently unavailable. Please try again shortly."
        : "Failed to generate ATS analysis.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ cvVersionId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { cvVersionId } = await context.params;

  const [cvVersion] = await db
    .select({ id: cvVersions.id })
    .from(cvVersions)
    .where(and(eq(cvVersions.id, cvVersionId), eq(cvVersions.userId, user.id)))
    .limit(1);
  if (!cvVersion) {
    return NextResponse.json({ error: "CV version not found." }, { status: 404 });
  }

  const jobId = req.nextUrl.searchParams.get("jobId");

  const conditions = jobId
    ? and(eq(atsAnalyses.cvVersionId, cvVersionId), eq(atsAnalyses.jobId, jobId))
    : eq(atsAnalyses.cvVersionId, cvVersionId);

  const [latest] = await db
    .select()
    .from(atsAnalyses)
    .where(conditions)
    .orderBy(desc(atsAnalyses.createdAt))
    .limit(1);

  return NextResponse.json({ atsAnalysis: latest ?? null });
}
