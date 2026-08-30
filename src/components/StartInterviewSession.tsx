"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface JobOption {
  id: string;
  title: string;
}

export function StartInterviewSession({ jobOptions }: { jobOptions: JobOption[] }) {
  const router = useRouter();
  const [jobId, setJobId] = useState(jobOptions[0]?.id ?? "");
  const [status, setStatus] = useState<"idle" | "generating" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (!jobId) return;
    setStatus("generating");
    setError(null);
    try {
      const res = await fetch("/api/interview-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to start interview prep.");
        setStatus("error");
        return;
      }
      router.push(`/interview-coach/${data.session.id}`);
    } catch {
      setError("Network error.");
      setStatus("error");
    }
  }

  if (jobOptions.length === 0) {
    return (
      <p className="text-sm text-slate-500">Analyze a job first to start interview prep for it.</p>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="block text-xs font-medium text-slate-600">Target job</label>
        <select
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          {jobOptions.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={start}
        disabled={status === "generating"}
        className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {status === "generating" ? "Preparing questions…" : "Start interview prep"}
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}
