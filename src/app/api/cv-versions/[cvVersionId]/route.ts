import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { cvVersions, auditLogs } from "@/lib/db/schema";

const renameSchema = z.object({
  versionLabel: z.string().min(1).max(255),
});

async function getOwnedVersion(id: string, userId: string) {
  const [row] = await db
    .select()
    .from(cvVersions)
    .where(and(eq(cvVersions.id, id), eq(cvVersions.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ cvVersionId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const { cvVersionId } = await context.params;
  const version = await getOwnedVersion(cvVersionId, user.id);
  if (!version) {
    return NextResponse.json({ error: "CV version not found." }, { status: 404 });
  }
  return NextResponse.json({ cvVersion: version });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ cvVersionId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const { cvVersionId } = await context.params;

  const existing = await getOwnedVersion(cvVersionId, user.id);
  if (!existing) {
    return NextResponse.json({ error: "CV version not found." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = renameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const [updated] = await db
    .update(cvVersions)
    .set({ versionLabel: parsed.data.versionLabel })
    .where(and(eq(cvVersions.id, cvVersionId), eq(cvVersions.userId, user.id)))
    .returning();

  return NextResponse.json({ cvVersion: updated });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ cvVersionId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const { cvVersionId } = await context.params;

  const existing = await getOwnedVersion(cvVersionId, user.id);
  if (!existing) {
    return NextResponse.json({ error: "CV version not found." }, { status: 404 });
  }

  await db
    .delete(cvVersions)
    .where(and(eq(cvVersions.id, cvVersionId), eq(cvVersions.userId, user.id)));

  await db.insert(auditLogs).values({
    userId: user.id,
    action: "CV_VERSION_DELETED",
    entityType: "cv_version",
    entityId: cvVersionId,
  });

  return NextResponse.json({ ok: true });
}
