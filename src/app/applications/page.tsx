import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireActiveAccessPage } from "@/lib/billing/gate";
import { db } from "@/lib/db/client";
import { applications } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { ApplicationTracker } from "@/components/ApplicationTracker";

export default async function ApplicationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await requireActiveAccessPage(user.id, user.role);

  const rows = await db
    .select()
    .from(applications)
    .where(eq(applications.userId, user.id))
    .orderBy(desc(applications.updatedAt));

  const serialized = rows.map((r) => ({
    ...r,
    dateApplied: r.dateApplied ? r.dateApplied.toISOString() : null,
    interviewDate: r.interviewDate ? r.interviewDate.toISOString() : null,
    followUpDate: r.followUpDate ? r.followUpDate.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Application Tracker</h1>
      <p className="mt-1 text-slate-600">
        Track every application from saved to offer — board or table view.
      </p>
      <div className="mt-6">
        <ApplicationTracker initialApplications={serialized} />
      </div>
    </main>
  );
}
