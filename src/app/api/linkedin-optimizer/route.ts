import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/session";
import { requireActiveAccessApi } from "@/lib/billing/gate";
import { db } from "@/lib/db/client";
import { linkedinOptimizations, auditLogs } from "@/lib/db/schema";
import { getFullCareerProfile } from "@/lib/career-profile/persist";
import { getAIProvider, AIProviderError } from "@/lib/ai";
import {
  buildLinkedinOptimizerPrompt,
  linkedinOptimizationSchema,
  LINKEDIN_OPTIMIZER_NAME,
  LINKEDIN_OPTIMIZER_VERSION,
} from "@/lib/ai/prompts/linkedinOptimizerPrompt";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const gateResponse = await requireActiveAccessApi();
  if (gateResponse) return gateResponse;

  const rl = checkRateLimit(`linkedin-optimizer:${user.id}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  const candidateProfile = await getFullCareerProfile(user.id);
  if (!candidateProfile) {
    return NextResponse.json(
      { error: "Please build your Master Career Profile (upload a CV) before optimizing LinkedIn content." },
      { status: 409 }
    );
  }

  try {
    const provider = getAIProvider();
    const { systemPrompt, userPrompt } = buildLinkedinOptimizerPrompt(JSON.stringify(candidateProfile));
    const { data } = await provider.generateStructured({
      systemPrompt,
      userPrompt,
      schema: linkedinOptimizationSchema,
      promptName: LINKEDIN_OPTIMIZER_NAME,
      promptVersion: LINKEDIN_OPTIMIZER_VERSION,
      userId: user.id,
    });

    const [created] = await db
      .insert(linkedinOptimizations)
      .values({
        userId: user.id,
        aiModel: provider.model,
        aiPromptVersion: LINKEDIN_OPTIMIZER_VERSION,
        content: data,
      })
      .returning();

    await db.insert(auditLogs).values({
      userId: user.id,
      action: "LINKEDIN_OPTIMIZATION_GENERATED",
      entityType: "linkedin_optimization",
      entityId: created.id,
    });

    return NextResponse.json({
      id: created.id,
      createdAt: created.createdAt,
      aiProvider: provider.name,
      content: data,
    });
  } catch (err) {
    const message =
      err instanceof AIProviderError
        ? "AI LinkedIn optimizer service is currently unavailable. Please try again shortly."
        : "Failed to generate LinkedIn optimization suggestions.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const [latest] = await db
    .select()
    .from(linkedinOptimizations)
    .where(eq(linkedinOptimizations.userId, user.id))
    .orderBy(desc(linkedinOptimizations.createdAt))
    .limit(1);

  if (!latest) {
    return NextResponse.json({ optimization: null });
  }

  return NextResponse.json({
    optimization: {
      id: latest.id,
      createdAt: latest.createdAt,
      aiModel: latest.aiModel,
      content: latest.content,
    },
  });
}
