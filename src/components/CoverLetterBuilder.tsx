"use client";

import { useState } from "react";

interface CoverLetter {
  id: string;
  jobId: string;
  tone: string;
  subject: string | null;
  body: string;
  aiModel: string;
  createdAt: string;
}

interface JobOption {
  id: string;
  title: string;
}

const TONES = ["PROFESSIONAL", "EXECUTIVE", "CONCISE", "TECHNICAL"] as const;

export function CoverLetterBuilder({
  initialLetters,
  jobOptions,
}: {
  initialLetters: CoverLetter[];
  jobOptions: JobOption[];
}) {
  const [letters, setLetters] = useState<CoverLetter[]>(initialLetters);
  const [jobId, setJobId] = useState(jobOptions[0]?.id ?? "");
  const [tone, setTone] = useState<(typeof TONES)[number]>("PROFESSIONAL");
  const [status, setStatus] = useState<"idle" | "generating" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(initialLetters[0]?.id ?? null);
  const [editBody, setEditBody] = useState<string>(initialLetters[0]?.body ?? "");
  const [saving, setSaving] = useState(false);

  const active = letters.find((l) => l.id === activeId) ?? null;

  function selectLetter(letter: CoverLetter) {
    setActiveId(letter.id);
    setEditBody(letter.body);
  }

  async function generate() {
    if (!jobId) return;
    setStatus("generating");
    setError(null);
    try {
      const res = await fetch("/api/cover-letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, tone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate cover letter.");
        setStatus("error");
        return;
      }
      setLetters((prev) => [data.coverLetter, ...prev]);
      selectLetter(data.coverLetter);
      setStatus("idle");
    } catch {
      setError("Network error.");
      setStatus("error");
    }
  }

  async function saveEdit() {
    if (!active) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/cover-letters/${active.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editBody }),
      });
      const data = await res.json();
      if (res.ok) {
        setLetters((prev) => prev.map((l) => (l.id === active.id ? data.coverLetter : l)));
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this cover letter?")) return;
    await fetch(`/api/cover-letters/${id}`, { method: "DELETE" });
    setLetters((prev) => prev.filter((l) => l.id !== id));
    if (activeId === id) setActiveId(null);
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-1">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Generate a cover letter</h2>
          <label className="mt-3 block text-xs font-medium text-slate-600">Target job</label>
          <select
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            {jobOptions.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
          <label className="mt-3 block text-xs font-medium text-slate-600">Tone</label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as (typeof TONES)[number])}
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            {TONES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
          <button
            onClick={generate}
            disabled={status === "generating" || !jobId}
            className="mt-3 w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {status === "generating" ? "Generating…" : "Generate letter"}
          </button>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          {jobOptions.length === 0 && (
            <p className="mt-2 text-xs text-slate-500">Analyze a job first to generate a cover letter for it.</p>
          )}
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Your letters</h2>
          <ul className="mt-2 space-y-1">
            {letters.map((l) => (
              <li key={l.id}>
                <button
                  onClick={() => selectLetter(l)}
                  className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                    activeId === l.id ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {l.subject || "Untitled letter"}
                  <span className="ml-1 text-xs text-slate-400">({l.tone.toLowerCase()})</span>
                </button>
              </li>
            ))}
            {letters.length === 0 && <li className="text-sm text-slate-500">No letters yet.</li>}
          </ul>
        </div>
      </div>

      <div className="md:col-span-2">
        {!active ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
            Select or generate a cover letter to preview it here.
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">{active.subject}</h2>
              <div className="flex gap-2 text-sm">
                <a href={`/api/cover-letters/${active.id}/export`} className="text-blue-600 hover:underline">
                  Export .txt
                </a>
                <a
                  href={`/api/cover-letters/${active.id}/export?format=docx`}
                  className="text-blue-600 hover:underline"
                >
                  Export .docx
                </a>
                <button onClick={() => remove(active.id)} className="text-red-600 hover:underline">
                  Delete
                </button>
              </div>
            </div>

            {active.aiModel.includes("mock") && (
              <div className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
                Generated by a deterministic development placeholder (no ANTHROPIC_API_KEY
                configured), not a real AI model — pipeline verification only.
              </div>
            )}

            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={16}
              className="mt-4 w-full rounded-md border border-slate-300 p-3 text-sm focus:border-blue-500 focus:outline-none"
            />
            <button
              onClick={saveEdit}
              disabled={saving || editBody === active.body}
              className="mt-2 rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save edits"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
