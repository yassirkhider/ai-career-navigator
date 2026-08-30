import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/session";
import { requireActiveAccessApi } from "@/lib/billing/gate";
import { db } from "@/lib/db/client";
import { jobs, jobRequirements, similarJobSuggestions, auditLogs } from "@/lib/db/schema";
import { getFullCareerProfile } from "@/lib/career-profile/persist";
import { getAIProvider, AIProviderError } from "@/lib/ai";
import {
  buildSimilarJobsPrompt,
  similarJobsSchema,
  SIMILAR_JOBS_NAME,
  SIMILAR_JOBS_VERSION,
} from "@/lib/ai/prompts/similarJobsPrompt";
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

  const rl = checkRateLimit(`similar-jobs:${user.id}`, 15, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  const { jobId } = await context.params;

  // IDOR protection: job must belong to the requesting user.
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, user.id)))
    .limit(1);
  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const candidateProfile = await getFullCareerProfile(user.id);
  if (!candidateProfile) {
    return NextResponse.json(
      { error: "Please build your Master Career Profile (upload a CV) before finding similar roles." },
      { status: 409 }
    );
  }

  const reqs = await db.select().from(jobRequirements).where(eq(jobRequirements.jobId, jobId));
  const requirementsText = reqs
    .map((r) => `(${r.importance}, ${r.category}): ${r.rawText}`)
    .join("\n");

  try {
    const provider = getAIProvider();
    const { systemPrompt, userPrompt } = buildSimilarJobsPrompt({
      jobTitle: job.title,
      jobRequirementsText: requirementsText || "(no specific requirements extracted)",
      candidateProfileJson: JSON.stringify(candidateProfile),
    });

    const { data } = await provider.generateStructured({
      systemPrompt,
      userPrompt,
      schema: similarJobsSchema,
      promptName: SIMILAR_JOBS_NAME,
      promptVersion: SIMILAR_JOBS_VERSION,
      userId: user.id,
    });

    const [created] = await db
      .insert(similarJobSuggestions)
      .values({
        userId: user.id,
        jobId,
        aiModel: provider.model,
        aiPromptVersion: SIMILAR_JOBS_VERSION,
        suggestions: data.suggestions,
      })
      .returning();

    await db.insert(auditLogs).values({
      userId: user.id,
      action: "SIMILAR_JOBS_GENERATED",
      entityType: "similar_job_suggestion",
      entityId: created.id,
    });

    return NextResponse.json({
      id: created.id,
      createdAt: created.createdAt,
      aiProvider: provider.name,
      suggestions: data.suggestions,
    });
  } catch (err) {
    const message =
      err instanceof AIProviderError
        ? "AI similar-roles service is currently unavailable. Please try again shortly."
        : "Failed to generate similar role suggestions.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const { jobId } = await context.params;

  const [job] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, user.id)))
    .limit(1);
  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const [latest] = await db
    .select()
    .from(similarJobSuggestions)
    .where(eq(similarJobSuggestions.jobId, jobId))
    .orderBy(desc(similarJobSuggestions.createdAt))
    .limit(1);

  return NextResponse.json({ result: latest ?? null });
}
