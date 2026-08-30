import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { requireActiveAccessPage } from "@/lib/billing/gate";
import { getFullCareerProfile } from "@/lib/career-profile/persist";
import { SkillsPassport } from "@/components/SkillsPassport";

export default async function SkillsPassportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await requireActiveAccessPage(user.id, user.role);

  const profile = await getFullCareerProfile(user.id);

  if (!profile) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900">Master Skills Passport</h1>
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="text-slate-600">Upload a CV first to populate your Skills Passport.</p>
          <Link href="/dashboard" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
            Go upload a CV →
          </Link>
        </div>
      </main>
    );
  }

  const serialized = profile.skills.map((s) => ({
    ...s,
    lastUsedDate: s.lastUsedDate ? s.lastUsedDate.toISOString() : null,
  }));

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Master Skills Passport</h1>
      <p className="mt-1 text-slate-600">
        Every skill in your profile, with its evidence, proficiency, and verification status.
        Edit any field to keep it accurate.
      </p>
      <div className="mt-6">
        <SkillsPassport initialSkills={serialized} />
      </div>
    </main>
  );
}
