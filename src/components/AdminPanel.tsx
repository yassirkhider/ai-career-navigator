"use client";

import { useEffect, useState } from "react";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  deletedAt: string | null;
}

interface Stats {
  totalUsers: number;
  totalJobs: number;
  totalCvUploads: number;
  aiInteractionsTotal: number;
  aiInteractionsSuccessful: number;
}

interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
}

export function AdminPanel({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [tab, setTab] = useState<"users" | "audit">("users");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
          return;
        }
        setUsers(d.users);
        setStats(d.stats);
      });
    fetch("/api/admin/audit-logs")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setLogs(d.auditLogs);
      });
  }, []);

  async function updateUser(userId: string, patch: { role?: string; suspended?: boolean }) {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (res.ok) {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...data.user } : u)));
    } else {
      setError(data.error || "Update failed.");
    }
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  return (
    <div>
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatCard label="Users" value={stats.totalUsers} />
          <StatCard label="Jobs analyzed" value={stats.totalJobs} />
          <StatCard label="CV uploads" value={stats.totalCvUploads} />
          <StatCard label="AI calls" value={stats.aiInteractionsTotal} />
          <StatCard
            label="AI success rate"
            value={
              stats.aiInteractionsTotal > 0
                ? `${Math.round((stats.aiInteractionsSuccessful / stats.aiInteractionsTotal) * 100)}%`
                : "—"
            }
          />
        </div>
      )}

      <div className="mt-6 flex rounded-md border border-slate-300 text-sm w-fit">
        <button
          onClick={() => setTab("users")}
          className={`px-3 py-1.5 ${tab === "users" ? "bg-blue-600 text-white" : "text-slate-600"}`}
        >
          Users
        </button>
        <button
          onClick={() => setTab("audit")}
          className={`px-3 py-1.5 ${tab === "audit" ? "bg-blue-600 text-white" : "text-slate-600"}`}
        >
          Audit log
        </button>
      </div>

      {tab === "users" ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="p-2">Email</th>
                <th className="p-2">Name</th>
                <th className="p-2">Role</th>
                <th className="p-2">Status</th>
                <th className="p-2">Joined</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100">
                  <td className="p-2">{u.email}</td>
                  <td className="p-2">{u.name ?? "—"}</td>
                  <td className="p-2">{u.role}</td>
                  <td className="p-2">
                    {u.deletedAt ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">Suspended</span>
                    ) : (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">Active</span>
                    )}
                  </td>
                  <td className="p-2 text-xs text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="p-2">
                    {u.id !== currentUserId && (
                      <div className="flex gap-2 text-xs">
                        <button
                          onClick={() => updateUser(u.id, { role: u.role === "ADMIN" ? "USER" : "ADMIN" })}
                          className="text-blue-600 hover:underline"
                        >
                          {u.role === "ADMIN" ? "Revoke admin" : "Make admin"}
                        </button>
                        <button
                          onClick={() => updateUser(u.id, { suspended: !u.deletedAt })}
                          className="text-red-600 hover:underline"
                        >
                          {u.deletedAt ? "Reactivate" : "Suspend"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="p-2">Action</th>
                <th className="p-2">Entity</th>
                <th className="p-2">User</th>
                <th className="p-2">When</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-slate-100">
                  <td className="p-2 font-medium text-slate-800">{l.action}</td>
                  <td className="p-2 text-xs text-slate-500">
                    {l.entityType ? `${l.entityType}:${l.entityId?.slice(0, 8)}` : "—"}
                  </td>
                  <td className="p-2 text-xs text-slate-500">{l.userId?.slice(0, 8) ?? "—"}</td>
                  <td className="p-2 text-xs text-slate-500">{new Date(l.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
      <p className="text-xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
