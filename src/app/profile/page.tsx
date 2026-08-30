import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { requireActiveAccessPage } from "@/lib/billing/gate";
import { getFullCareerProfile } from "@/lib/career-profile/persist";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await requireActiveAccessPage(user.id, user.role);

  const profile = await getFullCareerProfile(user.id);

  if (!profile) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900">Master Career Profile</h1>
        <p className="mt-3 text-slate-600">
          You haven&apos;t built a profile yet. Upload a CV from your dashboard to get started.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Master Career Profile</h1>

      {profile.profile.professionalSummary && (
        <section className="mt-6">
          <h2 className="font-semibold text-slate-900">Summary</h2>
          <p className="mt-2 text-sm text-slate-700">{profile.profile.professionalSummary}</p>
        </section>
      )}

      <section className="mt-6">
        <h2 className="font-semibold text-slate-900">Work Experience</h2>
        <ul className="mt-2 space-y-3">
          {profile.workExperiences.map((exp) => (
            <li key={exp.id} className="rounded-md border border-slate-200 p-3">
              <p className="font-medium text-slate-800">
                {exp.jobTitle} — {exp.employer}
              </p>
              {exp.rawSourceText && (
                <p className="mt-1 text-xs text-slate-500 italic">&ldquo;{exp.rawSourceText}&rdquo;</p>
              )}
            </li>
          ))}
          {profile.workExperiences.length === 0 && (
            <p className="text-sm text-slate-500">No work experience extracted yet.</p>
          )}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="font-semibold text-slate-900">Skills</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {profile.skills.map((s) => (
            <span
              key={s.id}
              title={s.evidenceText ?? undefined}
              className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
            >
              {s.skillName} · {s.proficiency.replace(/_/g, " ").toLowerCase()}
            </span>
          ))}
          {profile.skills.length === 0 && (
            <p className="text-sm text-slate-500">No skills extracted yet.</p>
          )}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="font-semibold text-slate-900">Education</h2>
        <ul className="mt-2 space-y-2">
          {profile.educations.map((edu) => (
            <li key={edu.id} className="text-sm text-slate-700">
              {edu.qualification} — {edu.institution}
            </li>
          ))}
          {profile.educations.length === 0 && (
            <p className="text-sm text-slate-500">No education extracted yet.</p>
          )}
        </ul>
      </section>
    </main>
  );
}
