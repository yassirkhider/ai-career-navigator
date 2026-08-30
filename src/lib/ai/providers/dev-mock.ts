import { z } from "zod";
import { AIProvider, AIProviderError } from "../types";
import { recordAiInteraction } from "../telemetry";

/**
 * DEVELOPMENT / TEST-ONLY PROVIDER.
 *
 * This is NOT a simulated AI response used to fake a feature — it exists
 * solely because this sandbox has no ANTHROPIC_API_KEY and no network path
 * to obtain one, so the real AnthropicProvider cannot be exercised here.
 * It refuses to run in production. Its only job is to let the request/
 * response pipeline (validation, DB writes, UI rendering) be verified
 * end-to-end with deterministic, clearly-labeled heuristic output instead
 * of a real model call.
 *
 * Swap ANTHROPIC_API_KEY into .env and this class is never instantiated —
 * see src/lib/ai/index.ts.
 */
export class DevMockProvider implements AIProvider {
  readonly name = "dev-mock (NOT a real AI response)";
  readonly model = "dev-mock-heuristic-v1";

  constructor() {
    if (process.env.NODE_ENV === "production") {
      throw new AIProviderError(
        "DevMockProvider must never be used in production. Set ANTHROPIC_API_KEY."
      );
    }
  }

  async generateStructured<T>(args: {
    systemPrompt: string;
    userPrompt: string;
    schema: z.ZodType<T>;
    promptName: string;
    promptVersion: string;
    userId?: string;
  }): Promise<{ data: T; usage: { inputTokens: number; outputTokens: number } }> {
    const start = Date.now();
    const raw = buildHeuristicResponse(args.promptName, args.userPrompt);
    try {
      const validated = args.schema.parse(raw);
      await recordAiInteraction({
        userId: args.userId,
        promptName: args.promptName,
        promptVersion: args.promptVersion,
        model: this.model,
        latencyMs: Date.now() - start,
        success: true,
      });
      return {
        data: validated,
        usage: { inputTokens: 0, outputTokens: 0 },
      };
    } catch (err) {
      await recordAiInteraction({
        userId: args.userId,
        promptName: args.promptName,
        promptVersion: args.promptVersion,
        model: this.model,
        latencyMs: Date.now() - start,
        success: false,
        errorMessage: String(err).slice(0, 500),
      });
      throw new AIProviderError(
        `DevMockProvider heuristic output for "${args.promptName}" failed schema validation — this indicates a bug in the mock, fix before relying on it for pipeline testing.`,
        err
      );
    }
  }
}

/**
 * Deliberately simple, transparent, rule-based heuristics — not ML, not an
 * LLM call. Good enough to prove the pipeline wiring works; not a substitute
 * for the real semantic analysis the spec requires, which only the real
 * AnthropicProvider can perform.
 */
function buildHeuristicResponse(promptName: string, userPrompt: string): unknown {
  switch (promptName) {
    case "careerProfileParser":
      return heuristicParseCareerProfile(userPrompt);
    case "jobParser":
      return heuristicParseJob(userPrompt);
    case "jobFit":
      return heuristicJobFit(userPrompt);
    case "careerPath":
      return heuristicCareerPath(userPrompt);
    case "cvRewrite":
      return heuristicCvRewrite(userPrompt);
    case "atsAnalysis":
      return heuristicAtsAnalysis(userPrompt);
    case "coverLetter":
      return heuristicCoverLetter(userPrompt);
    case "interviewQuestions":
      return heuristicInterviewQuestions(userPrompt);
    case "interviewAnswerScoring":
      return heuristicInterviewAnswerScoring(userPrompt);
    case "linkedinOptimizer":
      return heuristicLinkedinOptimizer(userPrompt);
    case "similarJobs":
      return heuristicSimilarJobs(userPrompt);
    case "courseRecommendations":
      return heuristicCourseRecommendations(userPrompt);
    default:
      throw new Error(`No heuristic implemented for prompt "${promptName}"`);
  }
}

function heuristicParseCareerProfile(userPrompt: string) {
  const text = extractDocumentBlock(userPrompt);
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const summary = lines.slice(0, 3).join(" ").slice(0, 400) || null;

  // very naive line-based extraction, looking for common CV patterns
  const workExperiences: Array<Record<string, unknown>> = [];
  const skillNames = new Set<string>();
  const knownSkills = [
    "SAP PM", "Primavera P6", "Power BI", "Python", "SQL", "JavaScript",
    "TypeScript", "React", "Project Management", "Leadership", "RCA",
    "Root Cause Analysis", "AutoCAD", "Excel", "Reliability Engineering",
    "Maintenance Planning", "PLC", "Six Sigma", "Lean Manufacturing",
  ];
  for (const skill of knownSkills) {
    if (text.toLowerCase().includes(skill.toLowerCase())) skillNames.add(skill);
  }

  const expRegex = /^(.*?)\s+(?:at|@|-)\s+(.*?)(?:\s*\(([^)]*)\))?$/i;
  for (const line of lines) {
    const m = line.match(expRegex);
    if (m && m[1].length < 60 && m[2].length < 60) {
      workExperiences.push({
        jobTitle: m[1].trim(),
        employer: m[2].trim(),
        dateRange: m[3]?.trim() ?? null,
        responsibilities: [],
        achievements: [],
        rawSourceText: line,
      });
    }
  }

  return {
    professionalSummary: summary,
    workExperiences: workExperiences.slice(0, 10),
    educations: [],
    certifications: [],
    skills: Array.from(skillNames).map((name) => ({
      name,
      category: "technical",
      evidenceText: findSentenceContaining(text, name),
      proficiency: "WORKING_KNOWLEDGE",
    })),
    languages: [],
  };
}

function heuristicParseJob(userPrompt: string) {
  const text = extractDocumentBlock(userPrompt);
  const lower = text.toLowerCase();
  const titleMatch = text.split("\n").find((l) => l.trim().length > 0) || "Untitled Role";

  const knownSkills = [
    "SAP PM", "Primavera P6", "Power BI", "Python", "SQL", "JavaScript",
    "TypeScript", "React", "Project Management", "Leadership", "RCA",
    "Root Cause Analysis", "AutoCAD", "Excel", "Reliability Engineering",
    "Maintenance Planning", "PLC", "Six Sigma", "Lean Manufacturing",
  ];
  const requirements = knownSkills
    .filter((s) => lower.includes(s.toLowerCase()))
    .map((s) => ({
      rawText: s,
      category: "TECHNICAL_SKILL",
      importance: lower.includes(`must have ${s.toLowerCase()}`) ? "MANDATORY" : "PREFERRED",
    }));

  if (requirements.length === 0) {
    requirements.push({
      rawText: "Relevant professional experience",
      category: "EXPERIENCE",
      importance: "MANDATORY",
    });
  }

  return {
    title: titleMatch.slice(0, 120),
    company: null,
    location: null,
    workMode: null,
    employmentType: null,
    salary: null,
    requirements,
  };
}

function heuristicJobFit(userPrompt: string) {
  // Extremely simple placeholder scoring so the pipeline (DB write, UI
  // render, decision engine copy) can be verified without a real model.
  // Requirements are formatted by buildJobFitPrompt as "[index] (...): text"
  // lines — count those rather than guessing from unrelated JSON content.
  const requirementLineMatches = userPrompt.match(/^\[\d+\]\s*\(/gm);
  const n = requirementLineMatches ? requirementLineMatches.length : 3;
  const matches = Array.from({ length: n }).map((_, i) => ({
    requirementIndex: i,
    matchStatus: i % 3 === 0 ? "GAP" : "MATCH",
    confidence: "MEDIUM",
    gapType: i % 3 === 0 ? "IMPORTANT_TRAINABLE" : "NONE",
    candidateEvidence: i % 3 === 0 ? null : "Evidence found in dev-mock heuristic pass.",
    recommendedAction: i % 3 === 0 ? "Take short course" : "No action required",
    priority: i % 3 === 0 ? "MEDIUM" : "LOW",
  }));

  const gapCount = matches.filter((m) => m.matchStatus === "GAP").length;
  const overallScore = Math.max(20, Math.round(100 - (gapCount / Math.max(n, 1)) * 60));

  return {
    overallScore,
    categoryScores: {
      mandatory: overallScore,
      technicalSkills: overallScore,
      experience: overallScore,
      education: null,
      certifications: null,
      softSkills: null,
      tools: null,
      industry: null,
      languages: null,
      location: null,
    },
    matches,
    recommendation:
      gapCount === 0 ? "GOOD MATCH – APPLY" : "APPLY WHILE CLOSING SKILL GAP",
    recommendationReason:
      "[dev-mock heuristic] This is a deterministic placeholder explanation generated without a real model call, for pipeline verification only.",
    strengths: ["dev-mock: pipeline executed successfully"],
    criticalGaps: gapCount > 0 ? ["dev-mock: sample trainable gap flagged"] : [],
  };
}

function heuristicCareerPath(userPrompt: string) {
  const text = extractDocumentBlock(userPrompt);
  let profileObj: {
    profile?: { currentJobTitle?: string | null };
    workExperiences?: Array<{ jobTitle?: string }>;
    skills?: Array<{ skillName?: string; name?: string }>;
  } = {};
  try {
    profileObj = JSON.parse(text);
  } catch {
    profileObj = {};
  }

  const currentTitle =
    profileObj.profile?.currentJobTitle ||
    profileObj.workExperiences?.[0]?.jobTitle ||
    "Professional";

  const skillNames = (profileObj.skills || [])
    .map((s) => s.skillName || s.name)
    .filter((s): s is string => Boolean(s));

  const strengths = skillNames.length
    ? skillNames.slice(0, 3).map((s) => `Demonstrated ${s} experience`)
    : ["Relevant professional experience"];

  return {
    paths: [
      {
        role: `Senior ${currentTitle}`,
        currentFitPercent: 75,
        keyStrengths: strengths,
        missingSkills: [],
        experienceNeeded: "Additional years of demonstrated seniority",
        transitionDifficulty: "EASY",
        recommendedPreparation: [
          "Document leadership examples on your CV",
          "Pursue a relevant advanced certification",
        ],
        rationale: `[dev-mock heuristic] Natural progression from ${currentTitle} based on the current profile — not a real AI assessment.`,
      },
      {
        role: `${currentTitle} Manager`,
        currentFitPercent: 55,
        keyStrengths: strengths.slice(0, 2),
        missingSkills: ["People management", "Budget planning"],
        experienceNeeded: "Supervisory experience",
        transitionDifficulty: "MODERATE",
        recommendedPreparation: [
          "Take a management fundamentals course",
          "Seek a team-lead assignment",
        ],
        rationale: `[dev-mock heuristic] Lateral move into management building on the ${currentTitle} background — not a real AI assessment.`,
      },
      {
        role: "Director of Operations",
        currentFitPercent: 30,
        keyStrengths: strengths.slice(0, 1),
        missingSkills: ["Strategic planning", "Cross-functional leadership"],
        experienceNeeded: "Several years in a management role first",
        transitionDifficulty: "CHALLENGING",
        recommendedPreparation: [
          "Build a track record in a management role first",
          "Consider an MBA or equivalent leadership training",
        ],
        rationale:
          "[dev-mock heuristic] Longer-range option requiring significant additional experience — not a real AI assessment.",
      },
    ],
  };
}

function heuristicCvRewrite(userPrompt: string) {
  const text = extractDocumentBlock(userPrompt);
  let profileObj: {
    profile?: { professionalSummary?: string | null };
    workExperiences?: Array<{
      jobTitle?: string;
      employer?: string;
      responsibilities?: string[];
      achievements?: string[];
      rawSourceText?: string | null;
    }>;
    skills?: Array<{ skillName?: string; name?: string }>;
  } = {};
  try {
    profileObj = JSON.parse(text);
  } catch {
    profileObj = {};
  }

  const professionalSummary =
    profileObj.profile?.professionalSummary ||
    "Experienced professional with a demonstrated track record across their field.";

  const workExperience = (profileObj.workExperiences || []).map((exp) => {
    const bullets: string[] = [];
    if (exp.responsibilities?.length) bullets.push(...exp.responsibilities);
    if (exp.achievements?.length) bullets.push(...exp.achievements);
    if (bullets.length === 0 && exp.rawSourceText) bullets.push(exp.rawSourceText);
    return {
      jobTitle: exp.jobTitle || "Role",
      employer: exp.employer || "Employer",
      bullets: bullets.slice(0, 5),
    };
  });

  const skillsHighlighted = (profileObj.skills || [])
    .map((s) => s.skillName || s.name)
    .filter((s): s is string => Boolean(s));

  return {
    professionalSummary,
    workExperience,
    skillsHighlighted,
    suggestedChanges: [
      "[dev-mock heuristic] Skills reordered by relevance — not a real AI rewrite.",
      "[dev-mock heuristic] No wording changes were made beyond what already exists in your stored profile.",
    ],
  };
}

function heuristicAtsAnalysis(userPrompt: string) {
  const blocks = extractAllDocumentBlocks(userPrompt);
  const cvText = blocks[0] ?? "";
  const jobText = blocks[1] ?? "";

  let cvContent: {
    professionalSummary?: string;
    workExperience?: Array<{ bullets?: string[] }>;
    skillsHighlighted?: string[];
  } = {};
  try {
    cvContent = JSON.parse(cvText);
  } catch {
    cvContent = {};
  }

  const allBullets = (cvContent.workExperience || []).flatMap((e) => e.bullets || []);
  const combinedCvText = [
    cvContent.professionalSummary || "",
    ...allBullets,
    ...(cvContent.skillsHighlighted || []),
  ]
    .join(" ")
    .toLowerCase();

  // job requirements formatted as "(IMPORTANCE, CATEGORY): text" per line.
  const requirementLines = jobText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];
  for (const line of requirementLines) {
    const idx = line.indexOf("): ");
    const term = idx >= 0 ? line.slice(idx + 3).trim() : line;
    if (!term) continue;
    if (combinedCvText.includes(term.toLowerCase())) {
      matchedKeywords.push(term);
    } else {
      missingKeywords.push(term);
    }
  }

  const total = matchedKeywords.length + missingKeywords.length;
  const coveragePct = total > 0 ? Math.round((matchedKeywords.length / total) * 100) : 50;

  const bulletsWithNumbers = allBullets.filter((b) => /\d/.test(b)).length;
  const measurableAchievementsScore =
    allBullets.length > 0 ? Math.round((bulletsWithNumbers / allBullets.length) * 100) : 0;

  const structureScore =
    (cvContent.professionalSummary ? 34 : 0) +
    ((cvContent.workExperience?.length ?? 0) > 0 ? 33 : 0) +
    ((cvContent.skillsHighlighted?.length ?? 0) > 0 ? 33 : 0);

  const overallScore = Math.round(coveragePct * 0.5 + structureScore * 0.2 + measurableAchievementsScore * 0.1 + 70 * 0.2);

  return {
    overallScore,
    keywordAlignmentScore: coveragePct,
    skillCoverageScore: coveragePct,
    readabilityScore: 70,
    structureScore,
    experienceRelevanceScore: coveragePct,
    measurableAchievementsScore,
    matchedKeywords,
    missingKeywords,
    potentialIssues:
      missingKeywords.length > 0
        ? [`[dev-mock heuristic] ${missingKeywords.length} job requirement term(s) not found anywhere in the CV content.`]
        : [],
    suggestions:
      missingKeywords.length > 0
        ? ["[dev-mock heuristic] Consider whether any missing terms reflect real experience that just isn't written down yet."]
        : ["[dev-mock heuristic] Keyword coverage looks complete against this job's extracted requirements."],
  };
}

function extractAllDocumentBlocks(prompt: string): string[] {
  const matches = [...prompt.matchAll(/<document>([\s\S]*?)<\/document>/g)];
  return matches.map((m) => m[1]);
}

function heuristicCoverLetter(userPrompt: string) {
  const blocks = extractAllDocumentBlocks(userPrompt);
  const profileText = blocks[0] ?? "";
  let profileObj: {
    profile?: { firstName?: string | null; lastName?: string | null; currentJobTitle?: string | null };
    workExperiences?: Array<{ jobTitle?: string; employer?: string }>;
    skills?: Array<{ skillName?: string; name?: string }>;
  } = {};
  try {
    profileObj = JSON.parse(profileText);
  } catch {
    profileObj = {};
  }

  const roleMatch = userPrompt.match(/Target role: (.*?)(?:\n|$)/);
  const roleLine = roleMatch ? roleMatch[1].trim() : "the advertised role";

  const currentTitle =
    profileObj.profile?.currentJobTitle || profileObj.workExperiences?.[0]?.jobTitle || "professional";
  const employer = profileObj.workExperiences?.[0]?.employer;
  const topSkills = (profileObj.skills || [])
    .slice(0, 3)
    .map((s) => s.skillName || s.name)
    .filter((s): s is string => Boolean(s));

  const fullName = [profileObj.profile?.firstName, profileObj.profile?.lastName]
    .filter(Boolean)
    .join(" ");

  const body = [
    "Dear Hiring Manager,",
    "",
    `I am writing to express my interest in ${roleLine}. As a ${currentTitle}${
      employer ? ` at ${employer}` : ""
    }, I have developed hands-on experience in ${
      topSkills.length ? topSkills.join(", ") : "my field"
    } that I believe would translate well to this role.`,
    "",
    "[dev-mock heuristic] This is a deterministic development placeholder, not a real AI-written letter.",
    "",
    "I would welcome the opportunity to discuss how my background could contribute to your team.",
    "",
    "Sincerely,",
    fullName || "[Candidate name]",
  ].join("\n");

  return {
    subject: `Application for ${roleLine}`,
    body,
  };
}

function heuristicInterviewQuestions(userPrompt: string) {
  const blocks = extractAllDocumentBlocks(userPrompt);
  const jobRequirementsText = blocks[1] ?? "";
  const firstReqLine = jobRequirementsText.split("\n").find((l) => l.trim());
  const firstReqTerm = firstReqLine ? firstReqLine.split("): ").pop()?.trim() : null;

  const roleMatch = userPrompt.match(/Target role: (.*?)(?:\n|$)/);
  const roleLine = roleMatch ? roleMatch[1].trim() : "this role";

  return {
    questions: [
      {
        text: `Can you walk me through your experience with ${firstReqTerm || "the core requirements of this role"}?`,
        type: "TECHNICAL",
      },
      {
        text: "Tell me about a time you handled a challenging situation in a previous role.",
        type: "BEHAVIORAL",
      },
      {
        text: "How would you approach an unexpected problem that puts a deadline at risk?",
        type: "SITUATIONAL",
      },
      {
        text: "Describe a specific project using the STAR method: what was the Situation, Task, Action, and Result?",
        type: "STAR",
      },
      {
        text: `What interests you specifically about the ${roleLine} position?`,
        type: "ROLE_SPECIFIC",
      },
      {
        text: "Is there any area of the role's requirements where your experience isn't fully reflected on your CV? Walk me through what you actually know or have done there.",
        type: "GAP_BASED",
      },
    ],
  };
}

function heuristicInterviewAnswerScoring(userPrompt: string) {
  const blocks = extractAllDocumentBlocks(userPrompt);
  const answerText = blocks[1] ?? "";
  const wordCount = answerText.trim().split(/\s+/).filter(Boolean).length;
  const hasStarLanguage = /situation|task|action|result/i.test(answerText);
  const hasNumbers = /\d/.test(answerText);

  const relevanceScore = wordCount > 20 ? 70 : 40;
  const technicalAccuracyScore = 60;
  const structureScore = hasStarLanguage ? 80 : 50;
  const evidenceScore = hasNumbers ? 75 : 45;
  const clarityScore = wordCount > 10 ? 65 : 35;
  const completenessScore = wordCount > 40 ? 75 : wordCount > 15 ? 55 : 30;

  const overallScore = Math.round(
    relevanceScore * 0.25 +
      technicalAccuracyScore * 0.15 +
      structureScore * 0.15 +
      evidenceScore * 0.15 +
      clarityScore * 0.15 +
      completenessScore * 0.15
  );

  return {
    relevanceScore,
    technicalAccuracyScore,
    structureScore,
    evidenceScore,
    clarityScore,
    completenessScore,
    overallScore,
    feedback: `[dev-mock heuristic] Scored from basic answer-length and keyword signals (${wordCount} words) — not a real AI assessment.`,
    improvedAnswerGuidance:
      "[dev-mock heuristic] Consider structuring your answer using the STAR method and referencing specific, real examples from your background.",
  };
}

function heuristicLinkedinOptimizer(userPrompt: string) {
  const text = extractDocumentBlock(userPrompt);
  let profileObj: {
    profile?: { currentJobTitle?: string | null; professionalSummary?: string | null };
    workExperiences?: Array<{ jobTitle?: string; employer?: string; rawSourceText?: string | null }>;
    skills?: Array<{ skillName?: string; name?: string }>;
  } = {};
  try {
    profileObj = JSON.parse(text);
  } catch {
    profileObj = {};
  }

  const currentTitle =
    profileObj.profile?.currentJobTitle ||
    profileObj.workExperiences?.[0]?.jobTitle ||
    "Professional";

  const skillNames = (profileObj.skills || [])
    .map((s) => s.skillName || s.name)
    .filter((s): s is string => Boolean(s));

  return {
    headline: `${currentTitle} | ${skillNames.slice(0, 3).join(" · ") || "Experienced professional"}`,
    about:
      `[dev-mock heuristic] ${profileObj.profile?.professionalSummary || `Experienced ${currentTitle} with a track record across their field.`} Not a real AI-written About section.`,
    experienceDescriptions: (profileObj.workExperiences || []).map((exp) => ({
      jobTitle: exp.jobTitle || "Role",
      employer: exp.employer || "Employer",
      description: exp.rawSourceText || `Worked as ${exp.jobTitle} at ${exp.employer}.`,
    })),
    skillsToAdd: skillNames,
    featuredContentSuggestions: [
      "[dev-mock heuristic] Consider featuring a project write-up or certificate relevant to your top skill.",
    ],
    keywords: skillNames,
  };
}

function heuristicSimilarJobs(userPrompt: string) {
  const titleMatch = userPrompt.match(/Analyzed job: (.*?)(?:\n|$)/);
  const jobTitle = titleMatch ? titleMatch[1].trim() : "this role";

  return {
    suggestions: [
      {
        title: `Senior ${jobTitle}`,
        relationshipType: "CAREER_PROGRESSION",
        suitabilityPercent: 65,
        rationale: "[dev-mock heuristic] A natural seniority step up from this role — not a real AI assessment.",
      },
      {
        title: `${jobTitle} Specialist`,
        relationshipType: "ALTERNATIVE_TITLE",
        suitabilityPercent: 70,
        rationale: "[dev-mock heuristic] Different title, largely overlapping day-to-day work — not a real AI assessment.",
      },
      {
        title: `Lead ${jobTitle}`,
        relationshipType: "SIMILAR_TITLE",
        suitabilityPercent: 60,
        rationale: "[dev-mock heuristic] Same core responsibilities with added leadership scope — not a real AI assessment.",
      },
      {
        title: `${jobTitle} Coordinator`,
        relationshipType: "ADJACENT_ROLE",
        suitabilityPercent: 55,
        rationale: "[dev-mock heuristic] Related field, distinct day-to-day focus — not a real AI assessment.",
      },
    ],
  };
}

function heuristicCourseRecommendations(userPrompt: string) {
  const skillMatch = userPrompt.match(/Target skill: (.*?)(?:\n|$)/);
  const skillName = skillMatch ? skillMatch[1].trim() : "this skill";
  const encoded = encodeURIComponent(skillName);

  return {
    recommendations: [
      {
        courseTitle: `${skillName} courses on Coursera`,
        provider: "Coursera",
        url: `https://www.coursera.org/search?query=${encoded}`,
        cost: "Free to audit; paid certificate",
        certificateAvailable: true,
        estimatedDuration: null,
        level: "BEGINNER",
        skillsCovered: [skillName],
        gapCoveragePercent: 60,
        reasonRecommended:
          "[dev-mock heuristic] Coursera hosts courses on this topic from universities and companies — not a real AI-verified recommendation, and this link goes to a search page rather than a specific verified course.",
        providerCredibility: "Coursera partners with accredited universities and major employers.",
      },
      {
        courseTitle: `${skillName} training on Microsoft Learn`,
        provider: "Microsoft Learn",
        url: `https://learn.microsoft.com/en-us/training/browse/?terms=${encoded}`,
        cost: "Free",
        certificateAvailable: true,
        estimatedDuration: null,
        level: "BEGINNER",
        skillsCovered: [skillName],
        gapCoveragePercent: 50,
        reasonRecommended:
          "[dev-mock heuristic] Microsoft Learn offers free self-paced modules with completion badges — not a real AI-verified recommendation, and this link goes to a search page rather than a specific verified course.",
        providerCredibility: "Official Microsoft training platform, free and widely recognized.",
      },
    ],
  };
}

function extractDocumentBlock(prompt: string): string {
  // Prompts wrap untrusted content in <document> tags (see prompts/*.ts).
  const match = prompt.match(/<document>([\s\S]*?)<\/document>/);
  return match ? match[1] : prompt;
}

function findSentenceContaining(text: string, needle: string): string | null {
  const idx = text.toLowerCase().indexOf(needle.toLowerCase());
  if (idx === -1) return null;
  const start = Math.max(0, text.lastIndexOf(".", idx) + 1);
  const end = text.indexOf(".", idx);
  return text.slice(start, end === -1 ? text.length : end + 1).trim().slice(0, 300);
}
