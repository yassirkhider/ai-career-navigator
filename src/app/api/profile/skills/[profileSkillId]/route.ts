import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { profileSkills, careerProfiles, auditLogs } from "@/lib/db/schema";

const proficiencyEnum = z.enum([
  "AWARENESS",
  "FOUNDATION",
  "WORKING_KNOWLEDGE",
  "PRACTICAL",
  "ADVANCED",
  "EXPERT",
]);

const updateSchema = z.object({
  proficiency: proficiencyEnum.optional(),
  yearsExperience: z.number().min(0).max(60).nullable().optional(),
  lastUsedDate: z.string().datetime().nullable().optional(),
  verified: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ profileSkillId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { profileSkillId } = await context.params;

  // IDOR protection: the skill must belong to a career profile owned by this
  // user (profileSkills has no direct userId column, so join through
  // careerProfiles rather than trusting the id alone).
  const [owned] = await db
    .select({ id: profileSkills.id })
    .from(profileSkills)
    .innerJoin(careerProfiles, eq(profileSkills.careerProfileId, careerProfiles.id))
    .where(and(eq(profileSkills.id, profileSkillId), eq(careerProfiles.userId, user.id)))
    .limit(1);

  if (!owned) {
    return NextResponse.json({ error: "Skill not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updates = parsed.data;
  const setValues: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    setValues[key] = key === "lastUsedDate" && value !== null ? new Date(value as string) : value;
  }

  if (Object.keys(setValues).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const [updated] = await db
    .update(profileSkills)
    .set(setValues)
    .where(eq(profileSkills.id, profileSkillId))
    .returning();

  await db.insert(auditLogs).values({
    userId: user.id,
    action: "SKILL_PASSPORT_UPDATED",
    entityType: "profile_skill",
    entityId: profileSkillId,
    metadata: setValues,
  });

  return NextResponse.json({ profileSkill: updated });
}
