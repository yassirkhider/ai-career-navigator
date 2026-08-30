import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db/client";
import { users, auditLogs } from "@/lib/db/schema";

const updateSchema = z.object({
  role: z.enum(["USER", "ADMIN"]).optional(),
  suspended: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { userId } = await context.params;

  if (userId === admin.id) {
    return NextResponse.json(
      { error: "You cannot change your own role or suspension status." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const setValues: Record<string, unknown> = {};
  if (parsed.data.role !== undefined) setValues.role = parsed.data.role;
  if (parsed.data.suspended !== undefined) {
    setValues.deletedAt = parsed.data.suspended ? new Date() : null;
  }

  if (Object.keys(setValues).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  const [updated] = await db
    .update(users)
    .set(setValues)
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      deletedAt: users.deletedAt,
    });

  await db.insert(auditLogs).values({
    userId: admin.id,
    action: "ADMIN_USER_UPDATED",
    entityType: "user",
    entityId: userId,
    metadata: { by: admin.id, changes: setValues },
  });

  return NextResponse.json({ user: updated });
}
