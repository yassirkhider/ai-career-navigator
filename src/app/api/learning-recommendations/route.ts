import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/session";
import { requireActiveAccessApi } from "@/lib/billing/gate";
import { db } from "@/lib/db/client";
import { courseRecommendationBatches, auditLogs } from "@/lib/db/schema";
import { AiCourseProvider } from "@/lib/learning/providers/aiProvider";
import { getAIProvider, AIProviderError } from "@/lib/ai";
import { checkRateLimit } from "@/lib/rate-limit";

const createSchema = z.object({
  skillName: z.string().min(1).max(200),
  context: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const gateResponse = await requireActiveAccessApi();
  if (gateResponse) return gateResponse;

  const rl = checkRateLimit(`course-recs:${user.id}`, 15, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A skillName is required." }, { status: 400 });
  }
  const { skillName, context } = parsed.data;

  try {
    const courseProvider = new AiCourseProvider();
    const recommendations = await courseProvider.suggestCourses({
      skillName,
      context,
      userId: user.id,
    });

    const aiProvider = getAIProvider();

    const [created] = await db
      .insert(courseRecommendationBatches)
      .values({
        userId: user.id,
        skillName,
        aiModel: aiProvider.model,
        aiPromptVersion: "v1",
        recommendations,
        verified: false,
        lastVerifiedDate: null,
      })
      .returning();

    await db.insert(auditLogs).values({
      userId: user.id,
      action: "COURSE_RECOMMENDATIONS_GENERATED",
      entityType: "course_recommendation_batch",
      entityId: created.id,
    });

    return NextResponse.json({ batch: created, aiProvider: aiProvider.name });
  } catch (err) {
    const message =
      err instanceof AIProviderError
        ? "AI course recommendation service is currently unavailable. Please try again shortly."
        : "Failed to generate course recommendations.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const batches = await db
    .select()
    .from(courseRecommendationBatches)
    .where(eq(courseRecommendationBatches.userId, user.id))
    .orderBy(desc(courseRecommendationBatches.createdAt));

  return NextResponse.json({ batches });
}
