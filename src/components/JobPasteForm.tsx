"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function JobPasteForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawDescription: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setError(data.error || "Failed to analyze job.");
        return;
      }
      router.push(`/jobs/${data.job.id}`);
      router.refresh();
    } catch {
      setStatus("error");
      setError("Network error.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-slate-900">Analyze a job</h2>
      <p className="mt-1 text-sm text-slate-500">Paste a job description to extract structured requirements.</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        required
        minLength={20}
        placeholder="Paste the full job posting text here…"
        className="mt-3 w-full rounded-md border border-slate-300 p-3 text-sm focus:border-blue-500 focus:outline-none"
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {status === "submitting" ? "Parsing…" : "Parse job"}
      </button>
    </form>
  );
}
