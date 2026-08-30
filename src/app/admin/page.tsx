import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { AdminPanel } from "@/components/AdminPanel";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // 404 rather than 403 for non-admins browsing the UI directly — avoids
  // signaling "this page exists but you're not allowed" to regular users.
  if (user.role !== "ADMIN") notFound();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
      <p className="mt-1 text-slate-600">User management, system stats, and audit trail.</p>
      <div className="mt-6">
        <AdminPanel currentUserId={user.id} />
      </div>
    </main>
  );
}
