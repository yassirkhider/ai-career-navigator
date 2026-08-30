/**
 * Course provider abstraction (Spec section 10). The Learning Recommendation
 * Engine is architected around this interface so that real per-platform
 * connectors (Coursera Catalog API, edX API, Microsoft Learn API, etc.) can
 * be added later without touching any caller.
 *
 * HONESTY NOTE: the only implementation currently wired in (AiCourseProvider)
 * generates suggestions from the underlying LLM's general knowledge of major
 * learning platforms — it does NOT call any live course-catalog API, so it
 * cannot confirm a specific course still exists, its current price, or that
 * an exact URL is live right now. To avoid ever presenting a fabricated
 * specific course-detail URL as if it were verified, the prompt instructs
 * the model to only link to a provider's stable homepage/search page (which
 * is always real) rather than inventing a course-detail path. Every
 * suggestion is persisted with verified=false and lastVerifiedDate=null
 * until a real catalog-API-backed provider is added.
 */
export interface CourseSuggestion {
  courseTitle: string;
  provider: string;
  url?: string | null;
  cost: string; // e.g. "Free", "Free with paid certificate", "$49", "Included in subscription"
  certificateAvailable: boolean;
  estimatedDuration?: string | null;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  skillsCovered: string[];
  gapCoveragePercent: number; // 0-100, how much of the target skill gap this course addresses
  reasonRecommended: string;
  providerCredibility: string; // short note on why this provider is credible
}

export interface CourseProvider {
  readonly name: string;
  suggestCourses(args: {
    skillName: string;
    context?: string;
    userId?: string;
  }): Promise<CourseSuggestion[]>;
}
