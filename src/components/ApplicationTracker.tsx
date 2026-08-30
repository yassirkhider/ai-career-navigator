"use client";

import { useState } from "react";

interface Application {
  id: string;
  jobId: string | null;
  jobTitle: string;
  company: string | null;
  status: string;
  cvVersionLabel: string | null;
  coverLetterNotes: string | null;
  dateApplied: string | null;
  contactName: string | null;
  contactEmail: string | null;
  interviewDate: string | null;
  followUpDate: string | null;
  notes: string | null;
  outcome: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUSES = [
  "SAVED",
  "PREPARING",
  "READY_TO_APPLY",
  "APPLIED",
  "RECRUITER_CONTACT",
  "INTERVIEW",
  "ASSESSMENT",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
  "ACCEPTED",
] as const;

const STATUS_LABELS: Record<string, string> = {
  SAVED: "Saved",
  PREPARING: "Preparing",
  READY_TO_APPLY: "Ready to Apply",
  APPLIED: "Applied",
  RECRUITER_CONTACT: "Recruiter Contact",
  INTERVIEW: "Interview",
  ASSESSMENT: "Assessment",
  OFFER: "Offer",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  ACCEPTED: "Accepted",
};

const STATUS_COLORS: Record<string, string> = {
  SAVED: "border-slate-300",
  PREPARING: "border-blue-300",
  READY_TO_APPLY: "border-blue-400",
  APPLIED: "border-indigo-400",
  RECRUITER_CONTACT: "border-purple-400",
  INTERVIEW: "border-amber-400",
  ASSESSMENT: "border-amber-500",
  OFFER: "border-green-500",
  REJECTED: "border-red-400",
  WITHDRAWN: "border-slate-400",
  ACCEPTED: "border-green-600",
};

export function ApplicationTracker({ initialApplications }: { initialApplications: Application[] }) {
  const [apps, setApps] = useState<Application[]>(initialApplications);
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/applications");
    const data = await res.json();
    if (res.ok) setApps(data.applications);
  }

  async function updateStatus(id: string, status: string) {
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    const res = await fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) await refresh(); // revert on failure
  }

  async function deleteApplication(id: string) {
    if (!confirm("Remove this application from your tracker?")) return;
    await fetch(`/api/applications/${id}`, { method: "DELETE" });
    setApps((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex rounded-md border border-slate-300 text-sm">
          <button
            onClick={() => setView("kanban")}
            className={`px-3 py-1.5 ${view === "kanban" ? "bg-blue-600 text-white" : "text-slate-600"}`}
          >
            Board
          </button>
          <button
            onClick={() => setView("table")}
            className={`px-3 py-1.5 ${view === "table" ? "bg-blue-600 text-white" : "text-slate-600"}`}
          >
            Table
          </button>
        </div>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          {showAddForm ? "Cancel" : "+ Add application"}
        </button>
      </div>

      {showAddForm && (
        <AddApplicationForm
          onCreated={(app) => {
            setApps((prev) => [app, ...prev]);
            setShowAddForm(false);
          }}
        />
      )}

      {view === "kanban" ? (
        <div className="mt-5 flex gap-3 overflow-x-auto pb-3">
          {STATUSES.map((status) => (
            <div key={status} className="w-64 flex-none">
              <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">
                {STATUS_LABELS[status]} ({apps.filter((a) => a.status === status).length})
              </h3>
              <div className="space-y-2">
                {apps
                  .filter((a) => a.status === status)
                  .map((a) => (
                    <div
                      key={a.id}
                      className={`rounded-md border-l-4 bg-white p-3 shadow-sm ${STATUS_COLORS[status]} border border-slate-200`}
                    >
                      <p className="text-sm font-medium text-slate-900">{a.jobTitle}</p>
                      {a.company && <p className="text-xs text-slate-500">{a.company}</p>}
                      <select
                        value={a.status}
                        onChange={(e) => updateStatus(a.id, e.target.value)}
                        className="mt-2 w-full rounded border border-slate-200 text-xs"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                        className="mt-2 text-xs text-blue-600 hover:underline"
                      >
                        {expandedId === a.id ? "Hide details" : "Details"}
                      </button>
                      {expandedId === a.id && (
                        <ApplicationDetailForm
                          key={a.id}
                          application={a}
                          onUpdated={(updated) =>
                            setApps((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
                          }
                          onDeleted={() => deleteApplication(a.id)}
                        />
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="p-2">Role</th>
                <th className="p-2">Company</th>
                <th className="p-2">Status</th>
                <th className="p-2">Applied</th>
                <th className="p-2">Interview</th>
                <th className="p-2">Follow-up</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id} className="border-b border-slate-100">
                  <td className="p-2 font-medium text-slate-800">{a.jobTitle}</td>
                  <td className="p-2 text-slate-600">{a.company ?? "—"}</td>
                  <td className="p-2">
                    <select
                      value={a.status}
                      onChange={(e) => updateStatus(a.id, e.target.value)}
                      className="rounded border border-slate-200 text-xs"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2 text-slate-600">{fmtDate(a.dateApplied)}</td>
                  <td className="p-2 text-slate-600">{fmtDate(a.interviewDate)}</td>
                  <td className="p-2 text-slate-600">{fmtDate(a.followUpDate)}</td>
                  <td className="p-2">
                    <button
                      onClick={() => deleteApplication(a.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {apps.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-slate-500">
                    No applications tracked yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

function AddApplicationForm({ onCreated }: { onCreated: (app: Application) => void }) {
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTitle, company: company || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to add application.");
        return;
      }
      onCreated(data.application);
      setJobTitle("");
      setCompany("");
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
      <div>
        <label className="block text-xs font-medium text-slate-600">Role *</label>
        <input
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          required
          className="mt-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">Company</label>
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="mt-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        Add
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}

function ApplicationDetailForm({
  application,
  onUpdated,
  onDeleted,
}: {
  application: Application;
  onUpdated: (app: Application) => void;
  onDeleted: () => void;
}) {
  const [notes, setNotes] = useState(application.notes ?? "");
  const [dateApplied, setDateApplied] = useState(toDateInput(application.dateApplied));
  const [interviewDate, setInterviewDate] = useState(toDateInput(application.interviewDate));
  const [followUpDate, setFollowUpDate] = useState(toDateInput(application.followUpDate));
  const [outcome, setOutcome] = useState(application.outcome ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: notes || null,
          dateApplied: dateApplied ? new Date(dateApplied).toISOString() : null,
          interviewDate: interviewDate ? new Date(interviewDate).toISOString() : null,
          followUpDate: followUpDate ? new Date(followUpDate).toISOString() : null,
          outcome: outcome || null,
        }),
      });
      const data = await res.json();
      if (res.ok) onUpdated(data.application);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
      <div>
        <label className="block text-xs text-slate-500">Date applied</label>
        <input
          type="date"
          value={dateApplied}
          onChange={(e) => setDateApplied(e.target.value)}
          className="w-full rounded border border-slate-200 text-xs"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500">Interview date</label>
        <input
          type="date"
          value={interviewDate}
          onChange={(e) => setInterviewDate(e.target.value)}
          className="w-full rounded border border-slate-200 text-xs"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500">Follow-up date</label>
        <input
          type="date"
          value={followUpDate}
          onChange={(e) => setFollowUpDate(e.target.value)}
          className="w-full rounded border border-slate-200 text-xs"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500">Outcome</label>
        <input
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          className="w-full rounded border border-slate-200 text-xs"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded border border-slate-200 text-xs"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={onDeleted} className="rounded px-2 py-1 text-xs text-red-600 hover:underline">
          Delete
        </button>
      </div>
    </div>
  );
}

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}
