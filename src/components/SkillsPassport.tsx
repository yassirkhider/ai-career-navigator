"use client";

import { useState } from "react";

interface PassportSkill {
  id: string;
  skillName: string;
  skillCategory: string;
  proficiency: string;
  evidenceText: string | null;
  evidenceSource: string | null;
  yearsExperience: number | null;
  lastUsedDate: string | null;
  verified: boolean;
}

const PROFICIENCIES = [
  "AWARENESS",
  "FOUNDATION",
  "WORKING_KNOWLEDGE",
  "PRACTICAL",
  "ADVANCED",
  "EXPERT",
] as const;

export function SkillsPassport({ initialSkills }: { initialSkills: PassportSkill[] }) {
  const [skills, setSkills] = useState<PassportSkill[]>(initialSkills);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function update(id: string, patch: Record<string, unknown>) {
    setSavingId(id);
    setSkills((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    try {
      const res = await fetch(`/api/profile/skills/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        // revert on failure by refetching
        const fresh = await fetch("/api/profile").then((r) => r.json());
        const freshSkill = fresh.profile?.skills?.find((s: PassportSkill) => s.id === id);
        if (freshSkill) setSkills((prev) => prev.map((s) => (s.id === id ? freshSkill : s)));
      }
    } finally {
      setSavingId(null);
    }
  }

  const categories = Array.from(new Set(skills.map((s) => s.skillCategory)));

  return (
    <div className="space-y-6">
      {categories.map((cat) => (
        <div key={cat} className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold capitalize text-slate-900">{cat.replace(/_/g, " ")}</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2 pr-3">Skill</th>
                  <th className="py-2 pr-3">Proficiency</th>
                  <th className="py-2 pr-3">Years</th>
                  <th className="py-2 pr-3">Last used</th>
                  <th className="py-2 pr-3">Verified</th>
                  <th className="py-2 pr-3">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {skills
                  .filter((s) => s.skillCategory === cat)
                  .map((s) => (
                    <tr key={s.id} className="border-b border-slate-100 align-top">
                      <td className="py-2 pr-3 font-medium text-slate-800">{s.skillName}</td>
                      <td className="py-2 pr-3">
                        <select
                          value={s.proficiency}
                          onChange={(e) => update(s.id, { proficiency: e.target.value })}
                          disabled={savingId === s.id}
                          className="rounded border border-slate-200 text-xs"
                        >
                          {PROFICIENCIES.map((p) => (
                            <option key={p} value={p}>
                              {p.replace(/_/g, " ").toLowerCase()}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="number"
                          min={0}
                          max={60}
                          value={s.yearsExperience ?? ""}
                          onChange={(e) =>
                            update(s.id, {
                              yearsExperience: e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          className="w-16 rounded border border-slate-200 px-1 text-xs"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="date"
                          value={s.lastUsedDate ? s.lastUsedDate.slice(0, 10) : ""}
                          onChange={(e) =>
                            update(s.id, {
                              lastUsedDate: e.target.value
                                ? new Date(e.target.value).toISOString()
                                : null,
                            })
                          }
                          className="rounded border border-slate-200 px-1 text-xs"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="checkbox"
                          checked={s.verified}
                          onChange={(e) => update(s.id, { verified: e.target.checked })}
                        />
                      </td>
                      <td className="max-w-xs py-2 pr-3 text-xs text-slate-500">
                        {s.evidenceText ?? <span className="italic">No evidence recorded.</span>}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {skills.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-slate-500">
          No skills recorded yet — upload a CV to populate your Skills Passport.
        </div>
      )}
    </div>
  );
}
