import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  careerProfiles,
  workExperiences,
  educations,
  certifications,
  skills,
  profileSkills,
  profileLanguages,
} from "@/lib/db/schema";
import type { CareerProfileExtraction } from "@/lib/ai/prompts/careerProfileParserPrompt";

/**
 * Merge an AI extraction into the user's Master Career Profile.
 * - Never deletes existing manually-edited work experience/education rows from
 *   OTHER uploads; each CV upload appends new evidenced entries.
 * - Original evidence (rawSourceText / evidenceText) is always preserved verbatim
 *   alongside the structured fields, per the anti-hallucination requirement.
 */
export async function persistCareerProfileExtraction(
  userId: string,
  extraction: CareerProfileExtraction
) {
  return db.transaction(async (tx) => {
    let [profile] = await tx
      .select()
      .from(careerProfiles)
      .where(eq(careerProfiles.userId, userId))
      .limit(1);

    if (!profile) {
      [profile] = await tx
        .insert(careerProfiles)
        .values({ userId })
        .returning();
    }

    if (extraction.professionalSummary && !profile.professionalSummary) {
      await tx
        .update(careerProfiles)
        .set({ professionalSummary: extraction.professionalSummary })
        .where(eq(careerProfiles.id, profile.id));
    }

    for (const exp of extraction.workExperiences) {
      // Skip entries where both identifying fields came back empty (the
      // defensive schema fallback converts a model-omitted field to "" to
      // avoid a hard failure — but an entry with neither a job title nor
      // an employer provides no value and would just show as a blank row).
      if (!exp.jobTitle.trim() && !exp.employer.trim()) continue;
      await tx.insert(workExperiences).values({
        careerProfileId: profile.id,
        jobTitle: exp.jobTitle,
        employer: exp.employer,
        responsibilities: exp.responsibilities,
        achievements: exp.achievements,
        rawSourceText: exp.rawSourceText,
      });
    }

    for (const edu of extraction.educations) {
      if (!edu.institution.trim() && !edu.qualification.trim()) continue;
      await tx.insert(educations).values({
        careerProfileId: profile.id,
        institution: edu.institution,
        qualification: edu.qualification,
        fieldOfStudy: edu.fieldOfStudy,
        rawSourceText: edu.rawSourceText,
      });
    }

    for (const cert of extraction.certifications) {
      if (!cert.name.trim()) continue;
      await tx.insert(certifications).values({
        careerProfileId: profile.id,
        name: cert.name,
        issuer: cert.issuer,
        rawSourceText: cert.rawSourceText,
      });
    }

    for (const skillExtraction of extraction.skills) {
      if (!skillExtraction.name.trim()) continue;
      let [skillRow] = await tx
        .select()
        .from(skills)
        .where(eq(skills.name, skillExtraction.name))
        .limit(1);

      if (!skillRow) {
        [skillRow] = await tx
          .insert(skills)
          .values({ name: skillExtraction.name, category: skillExtraction.category })
          .returning();
      }

      await tx
        .insert(profileSkills)
        .values({
          careerProfileId: profile.id,
          skillId: skillRow.id,
          proficiency: skillExtraction.proficiency,
          evidenceText: skillExtraction.evidenceText,
          evidenceSource: "CV upload — AI extraction",
        })
        .onConflictDoUpdate({
          target: [profileSkills.careerProfileId, profileSkills.skillId],
          set: {
            evidenceText: skillExtraction.evidenceText,
            proficiency: skillExtraction.proficiency,
          },
        });
    }

    for (const lang of extraction.languages) {
      await tx.insert(profileLanguages).values({
        careerProfileId: profile.id,
        language: lang.language,
        proficiency: lang.proficiency,
      });
    }

    return profile.id;
  });
}

export async function getFullCareerProfile(userId: string) {
  const [profile] = await db
    .select()
    .from(careerProfiles)
    .where(eq(careerProfiles.userId, userId))
    .limit(1);

  if (!profile) return null;

  const [exp, edu, certs, pSkills, langs] = await Promise.all([
    db.select().from(workExperiences).where(eq(workExperiences.careerProfileId, profile.id)),
    db.select().from(educations).where(eq(educations.careerProfileId, profile.id)),
    db.select().from(certifications).where(eq(certifications.careerProfileId, profile.id)),
    db
      .select({
        id: profileSkills.id,
        proficiency: profileSkills.proficiency,
        evidenceText: profileSkills.evidenceText,
        evidenceSource: profileSkills.evidenceSource,
        yearsExperience: profileSkills.yearsExperience,
        lastUsedDate: profileSkills.lastUsedDate,
        verified: profileSkills.verified,
        skillName: skills.name,
        skillCategory: skills.category,
      })
      .from(profileSkills)
      .innerJoin(skills, eq(profileSkills.skillId, skills.id))
      .where(eq(profileSkills.careerProfileId, profile.id)),
    db.select().from(profileLanguages).where(eq(profileLanguages.careerProfileId, profile.id)),
  ]);

  return {
    profile,
    workExperiences: exp,
    educations: edu,
    certifications: certs,
    skills: pSkills,
    languages: langs,
  };
}
