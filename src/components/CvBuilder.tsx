"use client";

import { useEffect, useState } from "react";

interface CvVersionContent {
  professionalSummary: string;
  workExperience: Array<{ jobTitle: string; employer: string; bullets: string[] }>;
  skillsHighlighted: string[];
  suggestedChanges: string[];
}

interface CvVersion {
  id: string;
  jobId: string | null;
  targetJobTitle: string | null;
  versionLabel: string;
  versionNumber: number;
  content: CvVersionContent;
  aiModel: string;
  createdAt: string;
  updatedAt: string;
}

interface AtsAnalysis {
  overallScore: number;
  keywordAlignmentScore: number | null;
  skillCoverageScore: number | null;
  readabilityScore: number | null;
  structureScore: number | null;
  experienceRelevanceScore: number | null;
  measurableAchievementsScore: number | null;
  matchedKeywords: string[];
  missingKeywords: string[];
  potentialIssues: string[];
  suggestions: string[];
  aiModel: string;
}

interface JobOption {
  id: string;
  title: string;
}

export function CvBuilder({
  initialVersions,
  jobOptions,
}: {
  initialVersions: CvVersion[];
  jobOptions: JobOption[];
}) {
  const [versions, setVersions] = useState<CvVersion[]>(initialVersions);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "generating" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(initialVersions[0]?.id ?? null);

  async function generate() {
    setStatus("generating");
    setError(null);
    try {
      const res = await fetch("/api/cv-versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: selectedJobId || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate CV.");
        setStatus("error");
        return;
      }
      setVersions((prev) => [data.cvVersion, ...prev]);
      setActiveId(data.cvVersion.id);
      setStatus("idle");
    } catch {
      setError("Network error.");
      setStatus("error");
    }
  }

  async function rename(id: string, currentLabel: string) {
    const next = prompt("Rename this CV version", currentLabel);
    if (!next || next === currentLabel) return;
    const res = await fetch(`/api/cv-versions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionLabel: next }),
    });
    if (res.ok) {
      const data = await res.json();
      setVersions((prev) => prev.map((v) => (v.id === id ? data.cvVersion : v)));
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this CV version? This cannot be undone.")) return;
    await fetch(`/api/cv-versions/${id}`, { method: "DELETE" });
    setVersions((prev) => prev.filter((v) => v.id !== id));
    if (activeId === id) setActiveId(null);
  }

  const active = versions.find((v) => v.id === activeId) ?? null;
  const isMock = active?.aiModel?.includes("mock") ?? false;

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-1">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Generate a targeted CV</h2>
          <label className="mt-3 block text-xs font-medium text-slate-600">Target job (optional)</label>
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">General strengthening pass</option>
            {jobOptions.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
          <button
            onClick={generate}
            disabled={status === "generating"}
            className="mt-3 w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {status === "generating" ? "Generating…" : "Generate CV"}
          </button>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Versions</h2>
          <ul className="mt-2 space-y-1">
            {versions.map((v) => (
              <li key={v.id}>
                <button
                  onClick={() => setActiveId(v.id)}
                  className={`w-full rounded-md px-2 py-1.5 text-left text-sm ${
                    activeId === v.id ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {v.versionLabel}
                </button>
              </li>
            ))}
            {versions.length === 0 && (
              <li className="text-sm text-slate-500">No versions yet.</li>
            )}
          </ul>
        </div>
      </div>

      <div className="md:col-span-2">
        {!active ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
            Select or generate a CV version to preview it here.
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">{active.versionLabel}</h2>
              <div className="flex gap-2 text-sm">
                <button onClick={() => rename(active.id, active.versionLabel)} className="text-blue-600 hover:underline">
                  Rename
                </button>
                <a
                  href={`/api/cv-versions/${active.id}/export`}
                  className="text-blue-600 hover:underline"
                >
                  Export .txt
                </a>
                <a
                  href={`/api/cv-versions/${active.id}/export?format=docx`}
                  className="text-blue-600 hover:underline"
                >
                  Export .docx
                </a>
                <button onClick={() => remove(active.id)} className="text-red-600 hover:underline">
                  Delete
                </button>
              </div>
            </div>

            {isMock && (
              <div className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
                Generated by a deterministic development placeholder (no ANTHROPIC_API_KEY
                configured), not a real AI model — pipeline verification only.
              </div>
            )}

            <section className="mt-4">
              <h3 className="text-xs font-semibold uppercase text-slate-500">Professional summary</h3>
              <p className="mt-1 text-sm text-slate-700">{active.content.professionalSummary}</p>
            </section>

            <section className="mt-4">
              <h3 className="text-xs font-semibold uppercase text-slate-500">Work experience</h3>
              <div className="mt-1 space-y-3">
                {active.content.workExperience.map((exp, i) => (
                  <div key={i}>
                    <p className="text-sm font-medium text-slate-800">
                      {exp.jobTitle} — {exp.employer}
                    </p>
                    <ul className="mt-1 list-inside list-disc text-sm text-slate-700">
                      {exp.bullets.map((b, j) => (
                        <li key={j}>{b}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-4">
              <h3 className="text-xs font-semibold uppercase text-slate-500">Skills highlighted</h3>
              <div className="mt-1 flex flex-wrap gap-1">
                {active.content.skillsHighlighted.map((s, i) => (
                  <span key={i} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                    {s}
                  </span>
                ))}
              </div>
            </section>

            {active.content.suggestedChanges.length > 0 && (
              <section className="mt-4">
                <h3 className="text-xs font-semibold uppercase text-slate-500">What was changed</h3>
                <ul className="mt-1 list-inside list-disc text-sm text-slate-600">
                  {active.content.suggestedChanges.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </section>
            )}

            <AtsCheckPanel key={active.id} cvVersion={active} jobOptions={jobOptions} />
          </div>
        )}
      </div>
    </div>
  );
}

function AtsCheckPanel({ cvVersion, jobOptions }: { cvVersion: CvVersion; jobOptions: JobOption[] }) {
  const [jobId, setJobId] = useState(cvVersion.jobId ?? jobOptions[0]?.id ?? "");
  const [analysis, setAnalysis] = useState<AtsAnalysis | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "checking" | "error">(
    jobId ? "checking" : "idle"
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    fetch(`/api/cv-versions/${cvVersion.id}/ats-analysis?jobId=${jobId}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setAnalysis(d.atsAnalysis ?? null);
        setStatus("idle");
      })
      .catch(() => {
        if (!cancelled) setStatus("idle");
      });
    return () => {
      cancelled = true;
    };
  }, [cvVersion.id, jobId]);

  async function runCheck() {
    if (!jobId) return;
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch(`/api/cv-versions/${cvVersion.id}/ats-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to run ATS check.");
        setStatus("error");
        return;
      }
      setAnalysis(data.atsAnalysis);
      setStatus("idle");
    } catch {
      setError("Network error.");
      setStatus("error");
    }
  }

  if (jobOptions.length === 0) {
    return (
      <section className="mt-6 border-t border-slate-100 pt-4">
        <h3 className="text-xs font-semibold uppercase text-slate-500">ATS readiness check</h3>
        <p className="mt-1 text-sm text-slate-500">Add a job to check this CV against.</p>
      </section>
    );
  }

  const scoreRows: Array<[string, number | null]> = analysis
    ? [
        ["Keyword alignment", analysis.keywordAlignmentScore],
        ["Skill coverage", analysis.skillCoverageScore],
        ["Readability", analysis.readabilityScore],
        ["Structure", analysis.structureScore],
        ["Experience relevance", analysis.experienceRelevanceScore],
        ["Measurable achievements", analysis.measurableAchievementsScore],
      ]
    : [];

  return (
    <section className="mt-6 border-t border-slate-100 pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase text-slate-500">ATS readiness check (estimated)</h3>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <select
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs"
        >
          {jobOptions.map((j) => (
            <option key={j.id} value={j.id}>
              {j.title}
            </option>
          ))}
        </select>
        <button
          onClick={runCheck}
          disabled={status === "loading"}
          className="rounded-md bg-slate-800 px-3 py-1 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50"
        >
          {status === "loading" ? "Checking…" : "Run ATS check"}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {analysis && (
        <div className="mt-3">
          {analysis.aiModel.includes("mock") && (
            <div className="mb-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800">
              Estimated by a deterministic development placeholder, not a real AI model.
            </div>
          )}
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-slate-900">{analysis.overallScore}</span>
            <span className="text-xs text-slate-500">estimated ATS readiness score (not a guarantee of any real system&apos;s output)</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {scoreRows.map(([label, value]) => (
              <div key={label} className="rounded border border-slate-100 p-2 text-center">
                <p className="text-[10px] text-slate-500">{label}</p>
                <p className="text-sm font-semibold text-slate-800">{value ?? "—"}</p>
              </div>
            ))}
          </div>

          {analysis.missingKeywords.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-slate-600">Missing keywords</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {analysis.missingKeywords.map((k, i) => (
                  <span key={i} className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}

          {analysis.potentialIssues.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-slate-600">Potential issues</p>
              <ul className="mt-1 list-inside list-disc text-xs text-slate-600">
                {analysis.potentialIssues.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {analysis.suggestions.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-slate-600">Suggestions</p>
              <ul className="mt-1 list-inside list-disc text-xs text-slate-600">
                {analysis.suggestions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
