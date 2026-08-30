import { CourseProvider, CourseSuggestion } from "../types";
import { getAIProvider } from "@/lib/ai";
import {
  buildCourseRecommendationsPrompt,
  courseRecommendationsSchema,
  COURSE_RECOMMENDATIONS_NAME,
  COURSE_RECOMMENDATIONS_VERSION,
} from "@/lib/ai/prompts/courseRecommendationsPrompt";

/**
 * Generates course suggestions from the underlying LLM's general knowledge.
 * See lib/learning/types.ts for the honesty notes on why URLs are
 * restricted to stable provider search/homepage pages rather than specific
 * course-detail links.
 */
export class AiCourseProvider implements CourseProvider {
  readonly name = "ai-general-knowledge";

  async suggestCourses(args: {
    skillName: string;
    context?: string;
    userId?: string;
  }): Promise<CourseSuggestion[]> {
    const provider = getAIProvider();
    const { systemPrompt, userPrompt } = buildCourseRecommendationsPrompt(args);
    const { data } = await provider.generateStructured({
      systemPrompt,
      userPrompt,
      schema: courseRecommendationsSchema,
      promptName: COURSE_RECOMMENDATIONS_NAME,
      promptVersion: COURSE_RECOMMENDATIONS_VERSION,
      userId: args.userId,
    });
    return data.recommendations;
  }
}
