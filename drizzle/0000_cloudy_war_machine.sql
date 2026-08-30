CREATE TYPE "public"."confidence" AS ENUM('HIGH', 'MEDIUM', 'LOW');--> statement-breakpoint
CREATE TYPE "public"."gap_type" AS ENUM('BLOCKING', 'IMPORTANT_TRAINABLE', 'PREFERRED', 'CV_VISIBILITY', 'EXPERIENCE', 'INFORMATION', 'NONE');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('STRONG_MATCH', 'MATCH', 'PARTIAL_MATCH', 'EVIDENCE_UNCLEAR', 'GAP', 'OPTIONAL_GAP', 'CV_VISIBILITY_GAP');--> statement-breakpoint
CREATE TYPE "public"."parse_status" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');--> statement-breakpoint
CREATE TYPE "public"."requirement_category" AS ENUM('TECHNICAL_SKILL', 'SOFT_SKILL', 'EXPERIENCE', 'EDUCATION', 'CERTIFICATION', 'LICENCE', 'LANGUAGE', 'INDUSTRY_KNOWLEDGE', 'TOOL_SOFTWARE', 'LOCATION_AUTHORIZATION');--> statement-breakpoint
CREATE TYPE "public"."requirement_importance" AS ENUM('MANDATORY', 'PREFERRED');--> statement-breakpoint
CREATE TYPE "public"."skill_proficiency" AS ENUM('AWARENESS', 'FOUNDATION', 'WORKING_KNOWLEDGE', 'PRACTICAL', 'ADVANCED', 'EXPERT');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('USER', 'ADMIN');--> statement-breakpoint
CREATE TABLE "ai_interactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"prompt_name" text NOT NULL,
	"prompt_version" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"latency_ms" integer,
	"success" boolean NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "career_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"location" text,
	"target_countries" text[] DEFAULT '{}'::text[] NOT NULL,
	"preferred_industries" text[] DEFAULT '{}'::text[] NOT NULL,
	"desired_job_roles" text[] DEFAULT '{}'::text[] NOT NULL,
	"years_of_experience" integer,
	"current_job_title" text,
	"employment_type_prefs" text[] DEFAULT '{}'::text[] NOT NULL,
	"work_mode_prefs" text[] DEFAULT '{}'::text[] NOT NULL,
	"willing_to_relocate" boolean,
	"work_authorization" text,
	"career_objectives" text,
	"professional_summary" text,
	"onboarding_complete" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certifications" (
	"id" text PRIMARY KEY NOT NULL,
	"career_profile_id" text NOT NULL,
	"name" text NOT NULL,
	"issuer" text,
	"issue_date" timestamp,
	"expiry_date" timestamp,
	"credential_id" text,
	"raw_source_text" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cv_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"original_filename" text NOT NULL,
	"stored_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"storage_path" text NOT NULL,
	"extracted_raw_text" text,
	"parse_status" "parse_status" DEFAULT 'PENDING' NOT NULL,
	"parse_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "educations" (
	"id" text PRIMARY KEY NOT NULL,
	"career_profile_id" text NOT NULL,
	"institution" text NOT NULL,
	"qualification" text NOT NULL,
	"field_of_study" text,
	"start_date" timestamp,
	"end_date" timestamp,
	"raw_source_text" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_analyses" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"user_id" text NOT NULL,
	"overall_score" integer NOT NULL,
	"mandatory_score" integer,
	"technical_skills_score" integer,
	"experience_score" integer,
	"education_score" integer,
	"certifications_score" integer,
	"soft_skills_score" integer,
	"tools_score" integer,
	"industry_score" integer,
	"languages_score" integer,
	"location_score" integer,
	"recommendation" text NOT NULL,
	"recommendation_reason" text NOT NULL,
	"strengths" text[] DEFAULT '{}'::text[] NOT NULL,
	"critical_gaps" text[] DEFAULT '{}'::text[] NOT NULL,
	"ai_model" text NOT NULL,
	"ai_prompt_version" text NOT NULL,
	"raw_ai_response" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_requirements" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"skill_id" text,
	"raw_text" text NOT NULL,
	"category" "requirement_category" NOT NULL,
	"importance" "requirement_importance" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"company" text,
	"location" text,
	"work_mode" text,
	"employment_type" text,
	"source_url" text,
	"raw_description" text NOT NULL,
	"salary" text,
	"application_deadline" timestamp,
	"parse_status" "parse_status" DEFAULT 'PENDING' NOT NULL,
	"parse_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_languages" (
	"id" text PRIMARY KEY NOT NULL,
	"career_profile_id" text NOT NULL,
	"language" text NOT NULL,
	"proficiency" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_skills" (
	"id" text PRIMARY KEY NOT NULL,
	"career_profile_id" text NOT NULL,
	"skill_id" text NOT NULL,
	"proficiency" "skill_proficiency" DEFAULT 'FOUNDATION' NOT NULL,
	"evidence_text" text,
	"evidence_source" text,
	"years_experience" real,
	"last_used_date" timestamp,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requirement_matches" (
	"id" text PRIMARY KEY NOT NULL,
	"job_analysis_id" text NOT NULL,
	"job_requirement_id" text NOT NULL,
	"match_status" "match_status" NOT NULL,
	"confidence" "confidence" NOT NULL,
	"gap_type" "gap_type",
	"candidate_evidence" text,
	"recommended_action" text,
	"priority" "priority"
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"session_token" text NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"email_verified" timestamp,
	"name" text,
	"role" "user_role" DEFAULT 'USER' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "work_experiences" (
	"id" text PRIMARY KEY NOT NULL,
	"career_profile_id" text NOT NULL,
	"job_title" text NOT NULL,
	"employer" text NOT NULL,
	"location" text,
	"start_date" timestamp,
	"end_date" timestamp,
	"is_current" boolean DEFAULT false NOT NULL,
	"responsibilities" text[] DEFAULT '{}'::text[] NOT NULL,
	"achievements" text[] DEFAULT '{}'::text[] NOT NULL,
	"raw_source_text" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "career_profiles" ADD CONSTRAINT "career_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_career_profile_id_career_profiles_id_fk" FOREIGN KEY ("career_profile_id") REFERENCES "public"."career_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cv_documents" ADD CONSTRAINT "cv_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "educations" ADD CONSTRAINT "educations_career_profile_id_career_profiles_id_fk" FOREIGN KEY ("career_profile_id") REFERENCES "public"."career_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_analyses" ADD CONSTRAINT "job_analyses_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_analyses" ADD CONSTRAINT "job_analyses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_requirements" ADD CONSTRAINT "job_requirements_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_requirements" ADD CONSTRAINT "job_requirements_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_languages" ADD CONSTRAINT "profile_languages_career_profile_id_career_profiles_id_fk" FOREIGN KEY ("career_profile_id") REFERENCES "public"."career_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_skills" ADD CONSTRAINT "profile_skills_career_profile_id_career_profiles_id_fk" FOREIGN KEY ("career_profile_id") REFERENCES "public"."career_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_skills" ADD CONSTRAINT "profile_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_matches" ADD CONSTRAINT "requirement_matches_job_analysis_id_job_analyses_id_fk" FOREIGN KEY ("job_analysis_id") REFERENCES "public"."job_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_matches" ADD CONSTRAINT "requirement_matches_job_requirement_id_job_requirements_id_fk" FOREIGN KEY ("job_requirement_id") REFERENCES "public"."job_requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_experiences" ADD CONSTRAINT "work_experiences_career_profile_id_career_profiles_id_fk" FOREIGN KEY ("career_profile_id") REFERENCES "public"."career_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_interactions_user_idx" ON "ai_interactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_interactions_prompt_idx" ON "ai_interactions" USING btree ("prompt_name");--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "career_profiles_user_idx" ON "career_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "certifications_profile_idx" ON "certifications" USING btree ("career_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cv_documents_stored_filename_idx" ON "cv_documents" USING btree ("stored_filename");--> statement-breakpoint
CREATE INDEX "cv_documents_user_idx" ON "cv_documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "educations_profile_idx" ON "educations" USING btree ("career_profile_id");--> statement-breakpoint
CREATE INDEX "job_analyses_job_idx" ON "job_analyses" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_analyses_user_idx" ON "job_analyses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "job_requirements_job_idx" ON "job_requirements" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "jobs_user_idx" ON "jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "profile_languages_profile_idx" ON "profile_languages" USING btree ("career_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_skills_unique_idx" ON "profile_skills" USING btree ("career_profile_id","skill_id");--> statement-breakpoint
CREATE INDEX "profile_skills_profile_idx" ON "profile_skills" USING btree ("career_profile_id");--> statement-breakpoint
CREATE INDEX "requirement_matches_analysis_idx" ON "requirement_matches" USING btree ("job_analysis_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_idx" ON "sessions" USING btree ("session_token");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "skills_name_idx" ON "skills" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "work_experiences_profile_idx" ON "work_experiences" USING btree ("career_profile_id");