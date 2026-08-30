CREATE TABLE "ats_analyses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"cv_version_id" text NOT NULL,
	"job_id" text NOT NULL,
	"overall_score" integer NOT NULL,
	"keyword_alignment_score" integer,
	"skill_coverage_score" integer,
	"readability_score" integer,
	"structure_score" integer,
	"experience_relevance_score" integer,
	"measurable_achievements_score" integer,
	"matched_keywords" text[] DEFAULT '{}'::text[] NOT NULL,
	"missing_keywords" text[] DEFAULT '{}'::text[] NOT NULL,
	"potential_issues" text[] DEFAULT '{}'::text[] NOT NULL,
	"suggestions" text[] DEFAULT '{}'::text[] NOT NULL,
	"ai_model" text NOT NULL,
	"ai_prompt_version" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ats_analyses" ADD CONSTRAINT "ats_analyses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ats_analyses" ADD CONSTRAINT "ats_analyses_cv_version_id_cv_versions_id_fk" FOREIGN KEY ("cv_version_id") REFERENCES "public"."cv_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ats_analyses" ADD CONSTRAINT "ats_analyses_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ats_analyses_cv_version_idx" ON "ats_analyses" USING btree ("cv_version_id");--> statement-breakpoint
CREATE INDEX "ats_analyses_job_idx" ON "ats_analyses" USING btree ("job_id");