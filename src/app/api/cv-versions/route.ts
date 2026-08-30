import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/session";
import { requireActiveAccessApi } from "@/lib/billing/gate";
import { db } from "@/lib/db/client";
import { cvVersions, jobs, jobRequirements, auditLogs } from "@/lib/db/schema";
import { getFullCareerProfile } from "@/lib/career-profile/persist";
import { getAIProvider, AIProviderError } from "@/lib/ai";
import {
  buildCvRewritePrompt,
  cvVersionContentSchema,
  CV_REWRITE_NAME,
  CV_REWRITE_VERSION,
} from "@/lib/ai/prompts/cvRewritePrompt";
import { checkRateLimit } from "@/lib/rate-limit";

const createSchema = z.object({
  jobId: z.string().nullable().optional(),
  versionLabel: z.string().min(1).max(255).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const gateResponse = await requireActiveAccessApi();
  if (gateResponse) return gateResponse;

  const rl = checkRateLimit(`cv-version-create:${user.id}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine — jobId/versionLabel are optional
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { jobId, versionLabel } = parsed.data;

  const candidateProfile = await getFullCareerProfile(user.id);
  if (!candidateProfile) {
    return NextResponse.json(
      { error: "Please build your Master Career Profile (upload a CV) before generating a targeted CV." },
      { status: 409 }
    );
  }

  let targetJobTitle: string | null = null;
  let requirementsText: string | null = null;

  if (jobId) {
    // IDOR protection: job must belong to the requesting user.
    const [job] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.userId, user.id)))
      .limit(1);
    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    targetJobTitle = job.title;
    const reqs = await db.select().from(jobRequirements).where(eq(jobRequirements.jobId, jobId));
    requirementsText = reqs
      .map((r) => `(${r.importance}, ${r.category}): ${r.rawText}`)
      .join("\n");
  }

  try {
    const provider = getAIProvider();
    const { systemPrompt, userPrompt } = buildCvRewritePrompt({
      candidateProfileJson: JSON.stringify(candidateProfile),
      targetJobRequirementsText: requirementsText,
    });

    const { data } = await provider.generateStructured({
      systemPrompt,
      userPrompt,
      schema: cvVersionContentSchema,
      promptName: CV_REWRITE_NAME,
      promptVersion: CV_REWRITE_VERSION,
      userId: user.id,
    });

    // Version numbering: sequential within the same target (same jobId, or
    // the "general" group when jobId is null).
    const existingForTarget = await db
      .select({ id: cvVersions.id })
      .from(cvVersions)
      .where(
        jobId
          ? and(eq(cvVersions.userId, user.id), eq(cvVersions.jobId, jobId))
          : eq(cvVersions.userId, user.id)
      );
    const versionNumber = existingForTarget.length + 1;

    const label =
      versionLabel ||
      (targetJobTitle ? `${targetJobTitle} CV v${versionNumber}` : `General CV v${versionNumber}`);

    const [created] = await db
      .insert(cvVersions)
      .values({
        userId: user.id,
        jobId: jobId ?? null,
        targetJobTitle,
        versionLabel: label,
        versionNumber,
        content: data,
        aiModel: provider.model,
        aiPromptVersion: CV_REWRITE_VERSION,
      })
      .returning();

    await db.insert(auditLogs).values({
      userId: user.id,
      action: "CV_VERSION_GENERATED",
      entityType: "cv_version",
      entityId: created.id,
    });

    return NextResponse.json({ cvVersion: created, aiProvider: provider.name }, { status: 201 });
  } catch (err) {
    const message =
      err instanceof AIProviderError
        ? "AI CV generation service is currently unavailable. Please try again shortly."
        : "Failed to generate targeted CV.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const versions = await db
    .select()
    .from(cvVersions)
    .where(eq(cvVersions.userId, user.id))
    .orderBy(desc(cvVersions.updatedAt));

  return NextResponse.json({ cvVersions: versions });
}
