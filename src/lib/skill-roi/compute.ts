import "server-only";
import { getAnalyzedRequirementsForUser } from "@/lib/analysis/latest";

// Categories that represent something a candidate can meaningfully "learn"
// or develop. Education/licence/language/location-authorization/experience
// requirements are excluded — they aren't solved by picking a course, and
// including them would make the ROI ranking misleading.
const LEARNABLE_CATEGORIES = new Set([
  "TECHNICAL_SKILL",
  "TOOL_SOFTWARE",
  "INDUSTRY_KNOWLEDGE",
  "SOFT_SKILL",
  "CERTIFICATION",
]);

const GAP_SEVERITY_RANK: Record<string, number> = {
  BLOCKING: 0,
  EXPERIENCE: 1,
  IMPORTANT_TRAINABLE: 2,
  CV_VISIBILITY: 3,
  INFORMATION: 4,
  PREFERRED: 5,
  NONE: 6,
};

const POSSESSED_STATUSES = new Set(["STRONG_MATCH", "MATCH", "PARTIAL_MATCH"]);

export type LearningEffort = "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
export type CareerImpact = "HIGH" | "MEDIUM" | "LOW";

export interface SkillRoiEntry {
  skillName: string;
  category: string;
  jobsRequiringSkill: number;
  demandFrequencyPct: number; // % of analyzed jobs that required this skill
  mandatoryCount: number;
  preferredCount: number;
  currentlyPossessed: boolean;
  worstGapType: string | null;
  learningEffort: LearningEffort;
  careerRelevanceScore: number; // 0-100
  estimatedCareerImpact: CareerImpact;
  gapPriorityScore: number | null; // null if already possessed — nothing to prioritize
  jobTitlesRequiringSkill: string[];
}

export interface SkillRoiSummary {
  jobsAnalyzed: number;
  totalSkillsTracked: number;
  skills: SkillRoiEntry[];
  recommendedLearningOrder: Array<{
    rank: number;
    skillName: string;
    reason: string;
  }>;
}

const EFFORT_PENALTY: Record<LearningEffort, number> = {
  LOW: 0,
  MEDIUM: 10,
  HIGH: 20,
  UNKNOWN: 15,
};

export async function computeSkillRoiForUser(userId: string): Promise<SkillRoiSummary> {
  const { jobsWithAnalysis, requirements } = await getAnalyzedRequirementsForUser(userId);

  const learnable = requirements.filter(
    (r) => LEARNABLE_CATEGORIES.has(r.category) && r.matchStatus !== null
  );

  // Group by normalized skill name (case/whitespace-insensitive) so
  // "SAP PM" and "sap pm" from different job postings collapse together.
  const groups = new Map<
    string,
    {
      displayName: string;
      category: string;
      jobIds: Set<string>;
      jobTitles: Set<string>;
      mandatoryCount: number;
      preferredCount: number;
      matchStatuses: string[];
      gapTypes: string[];
    }
  >();

  for (const req of learnable) {
    const key = req.rawText.trim().toLowerCase();
    let group = groups.get(key);
    if (!group) {
      group = {
        displayName: req.rawText.trim(),
        category: req.category,
        jobIds: new Set(),
        jobTitles: new Set(),
        mandatoryCount: 0,
        preferredCount: 0,
        matchStatuses: [],
        gapTypes: [],
      };
      groups.set(key, group);
    }
    group.jobIds.add(req.jobId);
    group.jobTitles.add(req.jobTitle);
    if (req.importance === "MANDATORY") group.mandatoryCount += 1;
    else group.preferredCount += 1;
    if (req.matchStatus) group.matchStatuses.push(req.matchStatus);
    if (req.gapType) group.gapTypes.push(req.gapType);
  }

  const skills: SkillRoiEntry[] = [];

  for (const group of groups.values()) {
    const jobsRequiringSkill = group.jobIds.size;
    const demandFrequencyPct =
      jobsWithAnalysis > 0 ? Math.round((jobsRequiringSkill / jobsWithAnalysis) * 100) : 0;

    const currentlyPossessed = group.matchStatuses.some((s) => POSSESSED_STATUSES.has(s));

    const worstGapType = currentlyPossessed
      ? null
      : group.gapTypes.reduce<string | null>((worst, gt) => {
          if (!worst) return gt;
          return (GAP_SEVERITY_RANK[gt] ?? 99) < (GAP_SEVERITY_RANK[worst] ?? 99) ? gt : worst;
        }, null);

    const learningEffort = deriveLearningEffort(currentlyPossessed, worstGapType);

    const mandatoryRatio = group.mandatoryCount / (group.mandatoryCount + group.preferredCount);
    const careerRelevanceScore = Math.round(
      demandFrequencyPct * 0.6 + mandatoryRatio * 100 * 0.4
    );

    const estimatedCareerImpact: CareerImpact =
      careerRelevanceScore >= 66 ? "HIGH" : careerRelevanceScore >= 33 ? "MEDIUM" : "LOW";

    const gapPriorityScore = currentlyPossessed
      ? null
      : Math.max(0, careerRelevanceScore - EFFORT_PENALTY[learningEffort]);

    skills.push({
      skillName: group.displayName,
      category: group.category,
      jobsRequiringSkill,
      demandFrequencyPct,
      mandatoryCount: group.mandatoryCount,
      preferredCount: group.preferredCount,
      currentlyPossessed,
      worstGapType,
      learningEffort,
      careerRelevanceScore,
      estimatedCareerImpact,
      gapPriorityScore,
      jobTitlesRequiringSkill: Array.from(group.jobTitles),
    });
  }

  // Highest demand / relevance first for the main table.
  skills.sort((a, b) => b.careerRelevanceScore - a.careerRelevanceScore);

  const recommendedLearningOrder = skills
    .filter((s) => !s.currentlyPossessed && s.gapPriorityScore !== null)
    .sort((a, b) => (b.gapPriorityScore ?? 0) - (a.gapPriorityScore ?? 0))
    .map((s, i) => ({
      rank: i + 1,
      skillName: s.skillName,
      reason: buildReason(s),
    }));

  return {
    jobsAnalyzed: jobsWithAnalysis,
    totalSkillsTracked: skills.length,
    skills,
    recommendedLearningOrder,
  };
}

function deriveLearningEffort(
  currentlyPossessed: boolean,
  worstGapType: string | null
): LearningEffort {
  if (currentlyPossessed) return "LOW";
  switch (worstGapType) {
    case "BLOCKING":
    case "EXPERIENCE":
      return "HIGH";
    case "CV_VISIBILITY":
      return "LOW"; // it's a wording fix, not new learning
    case "IMPORTANT_TRAINABLE":
      return "MEDIUM";
    case "PREFERRED":
      return "MEDIUM";
    case "INFORMATION":
      return "UNKNOWN";
    default:
      return "UNKNOWN";
  }
}

function buildReason(s: SkillRoiEntry): string {
  const parts: string[] = [];
  parts.push(`required in ${s.demandFrequencyPct}% of your analyzed jobs`);
  if (s.mandatoryCount > 0) {
    parts.push(`mandatory in ${s.mandatoryCount} of them`);
  }
  const effortLabel =
    s.learningEffort === "LOW"
      ? "low learning effort"
      : s.learningEffort === "MEDIUM"
        ? "moderate learning effort"
        : s.learningEffort === "HIGH"
          ? "significant effort (not a quick course)"
          : "effort unclear from your profile";
  parts.push(effortLabel);
  return parts.join(", ");
}
