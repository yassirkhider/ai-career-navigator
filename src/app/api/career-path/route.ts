import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/session";
import { requireActiveAccessApi } from "@/lib/billing/gate";
import { db } from "@/lib/db/client";
import { careerPathPredictions, auditLogs } from "@/lib/db/schema";
import { getFullCareerProfile } from "@/lib/career-profile/persist";
import { getAIProvider, AIProviderError } from "@/lib/ai";
import {
  buildCareerPathPrompt,
  careerPathSchema,
  CAREER_PATH_NAME,
  CAREER_PATH_VERSION,
} from "@/lib/ai/prompts/careerPathPrompt";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const gateResponse = await requireActiveAccessApi();
  if (gateResponse) return gateResponse;

  const rl = checkRateLimit(`career-path:${user.id}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  const candidateProfile = await getFullCareerProfile(user.id);
  if (!candidateProfile) {
    return NextResponse.json(
      { error: "Please build your Master Career Profile (upload a CV) before predicting career paths." },
      { status: 409 }
    );
  }

  try {
    const provider = getAIProvider();
    const { systemPrompt, userPrompt } = buildCareerPathPrompt(JSON.stringify(candidateProfile));
    const { data } = await provider.generateStructured({
      systemPrompt,
      userPrompt,
      schema: careerPathSchema,
      promptName: CAREER_PATH_NAME,
      promptVersion: CAREER_PATH_VERSION,
      userId: user.id,
    });

    const [prediction] = await db
      .insert(careerPathPredictions)
      .values({
        userId: user.id,
        aiModel: provider.model,
        aiPromptVersion: CAREER_PATH_VERSION,
        paths: data.paths,
      })
      .returning();

    await db.insert(auditLogs).values({
      userId: user.id,
      action: "CAREER_PATH_PREDICTED",
      entityType: "career_path_prediction",
      entityId: prediction.id,
    });

    return NextResponse.json({
      id: prediction.id,
      createdAt: prediction.createdAt,
      aiProvider: provider.name,
      paths: data.paths,
    });
  } catch (err) {
    const message =
      err instanceof AIProviderError
        ? "AI career path service is currently unavailable. Please try again shortly."
        : "Failed to generate career path prediction.";
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
    .from(careerPathPredictions)
    .where(eq(careerPathPredictions.userId, user.id))
    .orderBy(desc(careerPathPredictions.createdAt))
    .limit(1);

  if (!latest) {
    return NextResponse.json({ prediction: null });
  }

  return NextResponse.json({
    prediction: {
      id: latest.id,
      createdAt: latest.createdAt,
      paths: latest.paths,
    },
  });
}
