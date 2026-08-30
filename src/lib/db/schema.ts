import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  integer,
  boolean,
  real,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

// ============================================================
// ENUMS
// ============================================================
export const userRoleEnum = pgEnum("user_role", ["USER", "ADMIN"]);
export const parseStatusEnum = pgEnum("parse_status", [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
]);
export const skillProficiencyEnum = pgEnum("skill_proficiency", [
  "AWARENESS",
  "FOUNDATION",
  "WORKING_KNOWLEDGE",
  "PRACTICAL",
  "ADVANCED",
  "EXPERT",
]);
export const requirementCategoryEnum = pgEnum("requirement_category", [
  "TECHNICAL_SKILL",
  "SOFT_SKILL",
  "EXPERIENCE",
  "EDUCATION",
  "CERTIFICATION",
  "LICENCE",
  "LANGUAGE",
  "INDUSTRY_KNOWLEDGE",
  "TOOL_SOFTWARE",
  "LOCATION_AUTHORIZATION",
]);
export const requirementImportanceEnum = pgEnum("requirement_importance", [
  "MANDATORY",
  "PREFERRED",
]);
export const matchStatusEnum = pgEnum("match_status", [
  "STRONG_MATCH",
  "MATCH",
  "PARTIAL_MATCH",
  "EVIDENCE_UNCLEAR",
  "GAP",
  "OPTIONAL_GAP",
  "CV_VISIBILITY_GAP",
]);
export const confidenceEnum = pgEnum("confidence", ["HIGH", "MEDIUM", "LOW"]);
export const gapTypeEnum = pgEnum("gap_type", [
  "BLOCKING",
  "IMPORTANT_TRAINABLE",
  "PREFERRED",
  "CV_VISIBILITY",
  "EXPERIENCE",
  "INFORMATION",
  "NONE",
]);
export const priorityEnum = pgEnum("priority", [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
]);
export const applicationStatusEnum = pgEnum("application_status", [
  "SAVED",
  "PREPARING",
  "READY_TO_APPLY",
  "APPLIED",
  "RECRUITER_CONTACT",
  "INTERVIEW",
  "ASSESSMENT",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
  "ACCEPTED",
]);
export const coverLetterToneEnum = pgEnum("cover_letter_tone", [
  "PROFESSIONAL",
  "EXECUTIVE",
  "CONCISE",
  "TECHNICAL",
]);
export const interviewQuestionTypeEnum = pgEnum("interview_question_type", [
  "TECHNICAL",
  "BEHAVIORAL",
  "SITUATIONAL",
  "STAR",
  "ROLE_SPECIFIC",
  "GAP_BASED",
]);
export const similarRoleRelationshipEnum = pgEnum("similar_role_relationship", [
  "SIMILAR_TITLE",
  "ALTERNATIVE_TITLE",
  "ADJACENT_ROLE",
  "CAREER_PROGRESSION",
]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "TRIALING",
  "ACTIVE",
  "PAST_DUE",
  "CANCELED",
  "EXPIRED",
]);

const cuid = () => text().$defaultFn(() => createId());
const timestamps = {
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// ============================================================
// AUTH
// ============================================================
export const users = pgTable(
  "users",
  {
    id: cuid().primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    emailVerified: timestamp("email_verified"),
    name: text("name"),
    role: userRoleEnum("role").notNull().default("USER"),
    ...timestamps,
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)]
);

export const sessions = pgTable(
  "sessions",
  {
    id: cuid().primaryKey(),
    sessionToken: text("session_token").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sessions_token_idx").on(t.sessionToken),
    index("sessions_user_idx").on(t.userId),
  ]
);

// ============================================================
// MASTER CAREER PROFILE
// ============================================================
export const careerProfiles = pgTable(
  "career_profiles",
  {
    id: cuid().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    firstName: text("first_name"),
    lastName: text("last_name"),
    location: text("location"),
    targetCountries: text("target_countries")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    preferredIndustries: text("preferred_industries")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    desiredJobRoles: text("desired_job_roles")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    yearsOfExperience: integer("years_of_experience"),
    currentJobTitle: text("current_job_title"),
    employmentTypePrefs: text("employment_type_prefs")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    workModePrefs: text("work_mode_prefs")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    willingToRelocate: boolean("willing_to_relocate"),
    workAuthorization: text("work_authorization"),
    careerObjectives: text("career_objectives"),
    professionalSummary: text("professional_summary"),
    onboardingComplete: boolean("onboarding_complete").notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex("career_profiles_user_idx").on(t.userId)]
);

export const workExperiences = pgTable(
  "work_experiences",
  {
    id: cuid().primaryKey(),
    careerProfileId: text("career_profile_id")
      .notNull()
      .references(() => careerProfiles.id, { onDelete: "cascade" }),
    jobTitle: text("job_title").notNull(),
    employer: text("employer").notNull(),
    location: text("location"),
    startDate: timestamp("start_date"),
    endDate: timestamp("end_date"),
    isCurrent: boolean("is_current").notNull().default(false),
    responsibilities: text("responsibilities")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    achievements: text("achievements")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    rawSourceText: text("raw_source_text"),
    ...timestamps,
  },
  (t) => [index("work_experiences_profile_idx").on(t.careerProfileId)]
);

export const educations = pgTable(
  "educations",
  {
    id: cuid().primaryKey(),
    careerProfileId: text("career_profile_id")
      .notNull()
      .references(() => careerProfiles.id, { onDelete: "cascade" }),
    institution: text("institution").notNull(),
    qualification: text("qualification").notNull(),
    fieldOfStudy: text("field_of_study"),
    startDate: timestamp("start_date"),
    endDate: timestamp("end_date"),
    rawSourceText: text("raw_source_text"),
    ...timestamps,
  },
  (t) => [index("educations_profile_idx").on(t.careerProfileId)]
);

export const certifications = pgTable(
  "certifications",
  {
    id: cuid().primaryKey(),
    careerProfileId: text("career_profile_id")
      .notNull()
      .references(() => careerProfiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    issuer: text("issuer"),
    issueDate: timestamp("issue_date"),
    expiryDate: timestamp("expiry_date"),
    credentialId: text("credential_id"),
    rawSourceText: text("raw_source_text"),
    ...timestamps,
  },
  (t) => [index("certifications_profile_idx").on(t.careerProfileId)]
);

export const skills = pgTable(
  "skills",
  {
    id: cuid().primaryKey(),
    name: text("name").notNull(),
    category: text("category").notNull(),
  },
  (t) => [uniqueIndex("skills_name_idx").on(t.name)]
);

export const profileSkills = pgTable(
  "profile_skills",
  {
    id: cuid().primaryKey(),
    careerProfileId: text("career_profile_id")
      .notNull()
      .references(() => careerProfiles.id, { onDelete: "cascade" }),
    skillId: text("skill_id")
      .notNull()
      .references(() => skills.id),
    proficiency: skillProficiencyEnum("proficiency").notNull().default("FOUNDATION"),
    evidenceText: text("evidence_text"),
    evidenceSource: text("evidence_source"),
    yearsExperience: real("years_experience"),
    lastUsedDate: timestamp("last_used_date"),
    verified: boolean("verified").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("profile_skills_unique_idx").on(t.careerProfileId, t.skillId),
    index("profile_skills_profile_idx").on(t.careerProfileId),
  ]
);

export const profileLanguages = pgTable(
  "profile_languages",
  {
    id: cuid().primaryKey(),
    careerProfileId: text("career_profile_id")
      .notNull()
      .references(() => careerProfiles.id, { onDelete: "cascade" }),
    language: text("language").notNull(),
    proficiency: text("proficiency").notNull(),
  },
  (t) => [index("profile_languages_profile_idx").on(t.careerProfileId)]
);

// ============================================================
// CV DOCUMENTS
// ============================================================
export const cvDocuments = pgTable(
  "cv_documents",
  {
    id: cuid().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    originalFilename: text("original_filename").notNull(),
    storedFilename: text("stored_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull(),
    storagePath: text("storage_path").notNull(),
    extractedRawText: text("extracted_raw_text"),
    parseStatus: parseStatusEnum("parse_status").notNull().default("PENDING"),
    parseError: text("parse_error"),
    ...timestamps,
    deletedAt: timestamp("deleted_at"),
  },
  (t) => [
    uniqueIndex("cv_documents_stored_filename_idx").on(t.storedFilename),
    index("cv_documents_user_idx").on(t.userId),
  ]
);

// ============================================================
// JOBS
// ============================================================
export const jobs = pgTable(
  "jobs",
  {
    id: cuid().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    company: text("company"),
    location: text("location"),
    workMode: text("work_mode"),
    employmentType: text("employment_type"),
    sourceUrl: text("source_url"),
    rawDescription: text("raw_description").notNull(),
    salary: text("salary"),
    applicationDeadline: timestamp("application_deadline"),
    parseStatus: parseStatusEnum("parse_status").notNull().default("PENDING"),
    parseError: text("parse_error"),
    ...timestamps,
  },
  (t) => [index("jobs_user_idx").on(t.userId)]
);

export const jobRequirements = pgTable(
  "job_requirements",
  {
    id: cuid().primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    skillId: text("skill_id").references(() => skills.id),
    rawText: text("raw_text").notNull(),
    category: requirementCategoryEnum("category").notNull(),
    importance: requirementImportanceEnum("importance").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("job_requirements_job_idx").on(t.jobId)]
);

// ============================================================
// JOB FIT ANALYSIS
// ============================================================
export const jobAnalyses = pgTable(
  "job_analyses",
  {
    id: cuid().primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    overallScore: integer("overall_score").notNull(),
    mandatoryScore: integer("mandatory_score"),
    technicalSkillsScore: integer("technical_skills_score"),
    experienceScore: integer("experience_score"),
    educationScore: integer("education_score"),
    certificationsScore: integer("certifications_score"),
    softSkillsScore: integer("soft_skills_score"),
    toolsScore: integer("tools_score"),
    industryScore: integer("industry_score"),
    languagesScore: integer("languages_score"),
    locationScore: integer("location_score"),
    recommendation: text("recommendation").notNull(),
    recommendationReason: text("recommendation_reason").notNull(),
    strengths: text("strengths").array().notNull().default(sql`'{}'::text[]`),
    criticalGaps: text("critical_gaps")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    aiModel: text("ai_model").notNull(),
    aiPromptVersion: text("ai_prompt_version").notNull(),
    rawAiResponse: jsonb("raw_ai_response").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("job_analyses_job_idx").on(t.jobId),
    index("job_analyses_user_idx").on(t.userId),
  ]
);

export const requirementMatches = pgTable(
  "requirement_matches",
  {
    id: cuid().primaryKey(),
    jobAnalysisId: text("job_analysis_id")
      .notNull()
      .references(() => jobAnalyses.id, { onDelete: "cascade" }),
    jobRequirementId: text("job_requirement_id")
      .notNull()
      .references(() => jobRequirements.id, { onDelete: "cascade" }),
    matchStatus: matchStatusEnum("match_status").notNull(),
    confidence: confidenceEnum("confidence").notNull(),
    gapType: gapTypeEnum("gap_type"),
    candidateEvidence: text("candidate_evidence"),
    recommendedAction: text("recommended_action"),
    priority: priorityEnum("priority"),
  },
  (t) => [index("requirement_matches_analysis_idx").on(t.jobAnalysisId)]
);

// ============================================================
// CAREER PATH PREDICTION
// ============================================================
export const careerPathPredictions = pgTable(
  "career_path_predictions",
  {
    id: cuid().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    aiModel: text("ai_model").notNull(),
    aiPromptVersion: text("ai_prompt_version").notNull(),
    paths: jsonb("paths").notNull(), // array of CareerPathOption, see prompts/careerPathPrompt.ts
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("career_path_predictions_user_idx").on(t.userId)]
);

// ============================================================
// LEARNING RECOMMENDATION ENGINE
// ============================================================
export const courseRecommendationBatches = pgTable(
  "course_recommendation_batches",
  {
    id: cuid().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    skillName: text("skill_name").notNull(),
    aiModel: text("ai_model").notNull(),
    aiPromptVersion: text("ai_prompt_version").notNull(),
    recommendations: jsonb("recommendations").notNull(), // CourseSuggestion[], see lib/learning/types.ts
    // Always false / null until a real catalog-API-backed provider exists —
    // see lib/learning/types.ts for why. Kept as explicit DB columns (not
    // buried in the JSON) so the honesty signal survives any future schema
    // changes to the recommendations payload shape.
    verified: boolean("verified").notNull().default(false),
    lastVerifiedDate: timestamp("last_verified_date"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("course_recommendation_batches_user_idx").on(t.userId),
    index("course_recommendation_batches_skill_idx").on(t.skillName),
  ]
);

// ============================================================
// BILLING / SUBSCRIPTION
// ============================================================
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: cuid().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: subscriptionStatusEnum("status").notNull().default("TRIALING"),
    trialEndsAt: timestamp("trial_ends_at").notNull(),
    currentPeriodEnd: timestamp("current_period_end"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripePriceId: text("stripe_price_id"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("subscriptions_user_idx").on(t.userId),
    index("subscriptions_stripe_customer_idx").on(t.stripeCustomerId),
    index("subscriptions_stripe_subscription_idx").on(t.stripeSubscriptionId),
  ]
);

// ============================================================
// SIMILAR JOB DISCOVERY
// ============================================================
export const similarJobSuggestions = pgTable(
  "similar_job_suggestions",
  {
    id: cuid().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    aiModel: text("ai_model").notNull(),
    aiPromptVersion: text("ai_prompt_version").notNull(),
    suggestions: jsonb("suggestions").notNull(), // see prompts/similarJobsPrompt.ts
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("similar_job_suggestions_user_idx").on(t.userId),
    index("similar_job_suggestions_job_idx").on(t.jobId),
  ]
);

// ============================================================
// LINKEDIN OPTIMIZER
// ============================================================
export const linkedinOptimizations = pgTable(
  "linkedin_optimizations",
  {
    id: cuid().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    aiModel: text("ai_model").notNull(),
    aiPromptVersion: text("ai_prompt_version").notNull(),
    content: jsonb("content").notNull(), // see prompts/linkedinOptimizerPrompt.ts
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("linkedin_optimizations_user_idx").on(t.userId)]
);

// ============================================================
// AI INTERVIEW COACH
// ============================================================
export const interviewSessions = pgTable(
  "interview_sessions",
  {
    id: cuid().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    aiModel: text("ai_model").notNull(),
    aiPromptVersion: text("ai_prompt_version").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("interview_sessions_user_idx").on(t.userId),
    index("interview_sessions_job_idx").on(t.jobId),
  ]
);

export const interviewQuestions = pgTable(
  "interview_questions",
  {
    id: cuid().primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => interviewSessions.id, { onDelete: "cascade" }),
    questionText: text("question_text").notNull(),
    questionType: interviewQuestionTypeEnum("question_type").notNull(),
    orderIndex: integer("order_index").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("interview_questions_session_idx").on(t.sessionId)]
);

export const interviewAnswers = pgTable(
  "interview_answers",
  {
    id: cuid().primaryKey(),
    questionId: text("question_id")
      .notNull()
      .references(() => interviewQuestions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    answerText: text("answer_text").notNull(),
    relevanceScore: integer("relevance_score").notNull(),
    technicalAccuracyScore: integer("technical_accuracy_score").notNull(),
    structureScore: integer("structure_score").notNull(),
    evidenceScore: integer("evidence_score").notNull(),
    clarityScore: integer("clarity_score").notNull(),
    completenessScore: integer("completeness_score").notNull(),
    overallScore: integer("overall_score").notNull(),
    feedback: text("feedback").notNull(),
    improvedAnswerGuidance: text("improved_answer_guidance").notNull(),
    aiModel: text("ai_model").notNull(),
    aiPromptVersion: text("ai_prompt_version").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("interview_answers_question_idx").on(t.questionId),
    index("interview_answers_user_idx").on(t.userId),
  ]
);

// ============================================================
// COVER LETTER GENERATOR
// ============================================================
export const coverLetters = pgTable(
  "cover_letters",
  {
    id: cuid().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    tone: coverLetterToneEnum("tone").notNull().default("PROFESSIONAL"),
    subject: text("subject"),
    body: text("body").notNull(),
    aiModel: text("ai_model").notNull(),
    aiPromptVersion: text("ai_prompt_version").notNull(),
    ...timestamps,
  },
  (t) => [
    index("cover_letters_user_idx").on(t.userId),
    index("cover_letters_job_idx").on(t.jobId),
  ]
);

// ============================================================
// ATS ANALYSIS
// ============================================================
export const atsAnalyses = pgTable(
  "ats_analyses",
  {
    id: cuid().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cvVersionId: text("cv_version_id")
      .notNull()
      .references(() => cvVersions.id, { onDelete: "cascade" }),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    overallScore: integer("overall_score").notNull(),
    keywordAlignmentScore: integer("keyword_alignment_score"),
    skillCoverageScore: integer("skill_coverage_score"),
    readabilityScore: integer("readability_score"),
    structureScore: integer("structure_score"),
    experienceRelevanceScore: integer("experience_relevance_score"),
    measurableAchievementsScore: integer("measurable_achievements_score"),
    matchedKeywords: text("matched_keywords").array().notNull().default(sql`'{}'::text[]`),
    missingKeywords: text("missing_keywords").array().notNull().default(sql`'{}'::text[]`),
    potentialIssues: text("potential_issues").array().notNull().default(sql`'{}'::text[]`),
    suggestions: text("suggestions").array().notNull().default(sql`'{}'::text[]`),
    aiModel: text("ai_model").notNull(),
    aiPromptVersion: text("ai_prompt_version").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("ats_analyses_cv_version_idx").on(t.cvVersionId),
    index("ats_analyses_job_idx").on(t.jobId),
  ]
);

// ============================================================
// CV BUILDER / VERSION CONTROL
// ============================================================
export const cvVersions = pgTable(
  "cv_versions",
  {
    id: cuid().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Optional: the job this CV was tailored against. Snapshotting the
    // title separately means the version stays meaningful even if the job
    // is later deleted.
    jobId: text("job_id").references(() => jobs.id, { onDelete: "set null" }),
    targetJobTitle: text("target_job_title"),
    versionLabel: text("version_label").notNull(),
    versionNumber: integer("version_number").notNull().default(1),
    content: jsonb("content").notNull(), // see prompts/cvRewritePrompt.ts for shape
    aiModel: text("ai_model").notNull(),
    aiPromptVersion: text("ai_prompt_version").notNull(),
    ...timestamps,
  },
  (t) => [
    index("cv_versions_user_idx").on(t.userId),
    index("cv_versions_job_idx").on(t.jobId),
  ]
);

// ============================================================
// APPLICATION TRACKER
// ============================================================
export const applications = pgTable(
  "applications",
  {
    id: cuid().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // jobId is optional: a user can track an application they never ran
    // through the AI job-fit pipeline. jobTitle/company are captured as a
    // snapshot at creation time so the tracker still works if the linked
    // job is later deleted.
    jobId: text("job_id").references(() => jobs.id, { onDelete: "set null" }),
    jobTitle: text("job_title").notNull(),
    company: text("company"),
    status: applicationStatusEnum("status").notNull().default("SAVED"),
    cvVersionLabel: text("cv_version_label"),
    coverLetterNotes: text("cover_letter_notes"),
    dateApplied: timestamp("date_applied"),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    interviewDate: timestamp("interview_date"),
    followUpDate: timestamp("follow_up_date"),
    notes: text("notes"),
    outcome: text("outcome"),
    ...timestamps,
  },
  (t) => [
    index("applications_user_idx").on(t.userId),
    index("applications_job_idx").on(t.jobId),
  ]
);

// ============================================================
// OBSERVABILITY
// ============================================================
export const aiInteractions = pgTable(
  "ai_interactions",
  {
    id: cuid().primaryKey(),
    userId: text("user_id"),
    promptName: text("prompt_name").notNull(),
    promptVersion: text("prompt_version").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    latencyMs: integer("latency_ms"),
    success: boolean("success").notNull(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("ai_interactions_user_idx").on(t.userId),
    index("ai_interactions_prompt_idx").on(t.promptName),
  ]
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: cuid().primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("audit_logs_user_idx").on(t.userId)]
);

// ============================================================
// RELATIONS
// ============================================================
export const usersRelations = relations(users, ({ one, many }) => ({
  careerProfile: one(careerProfiles),
  cvDocuments: many(cvDocuments),
  jobs: many(jobs),
  sessions: many(sessions),
}));

export const careerProfilesRelations = relations(careerProfiles, ({ one, many }) => ({
  user: one(users, { fields: [careerProfiles.userId], references: [users.id] }),
  workExperiences: many(workExperiences),
  educations: many(educations),
  certifications: many(certifications),
  profileSkills: many(profileSkills),
  languages: many(profileLanguages),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  user: one(users, { fields: [jobs.userId], references: [users.id] }),
  requirements: many(jobRequirements),
  analyses: many(jobAnalyses),
}));

export const jobAnalysesRelations = relations(jobAnalyses, ({ one, many }) => ({
  job: one(jobs, { fields: [jobAnalyses.jobId], references: [jobs.id] }),
  matches: many(requirementMatches),
}));

export const requirementMatchesRelations = relations(requirementMatches, ({ one }) => ({
  jobAnalysis: one(jobAnalyses, {
    fields: [requirementMatches.jobAnalysisId],
    references: [jobAnalyses.id],
  }),
  jobRequirement: one(jobRequirements, {
    fields: [requirementMatches.jobRequirementId],
    references: [jobRequirements.id],
  }),
}));
