import { NextResponse } from "next/server";
import { desc, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db/client";
import { users, aiInteractions, jobs, cvDocuments } from "@/lib/db/schema";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  // Deliberately account-metadata only — never career profile content,
  // uploaded CV text, or job/analysis data. Spec: "Admins must never
  // casually access sensitive user career documents."
  const userRows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  const [{ count: totalUsers }] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  const [{ count: totalJobs }] = await db.select({ count: sql<number>`count(*)::int` }).from(jobs);
  const [{ count: totalCvUploads }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(cvDocuments);
  const [aiStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      successful: sql<number>`count(*) filter (where success = true)::int`,
    })
    .from(aiInteractions);

  return NextResponse.json({
    users: userRows,
    stats: {
      totalUsers,
      totalJobs,
      totalCvUploads,
      aiInteractionsTotal: aiStats?.total ?? 0,
      aiInteractionsSuccessful: aiStats?.successful ?? 0,
    },
  });
}
