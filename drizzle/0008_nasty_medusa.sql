CREATE TYPE "public"."similar_role_relationship" AS ENUM('SIMILAR_TITLE', 'ALTERNATIVE_TITLE', 'ADJACENT_ROLE', 'CAREER_PROGRESSION');--> statement-breakpoint
CREATE TABLE "similar_job_suggestions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"job_id" text NOT NULL,
	"ai_model" text NOT NULL,
	"ai_prompt_version" text NOT NULL,
	"suggestions" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "similar_job_suggestions" ADD CONSTRAINT "similar_job_suggestions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "similar_job_suggestions" ADD CONSTRAINT "similar_job_suggestions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "similar_job_suggestions_user_idx" ON "similar_job_suggestions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "similar_job_suggestions_job_idx" ON "similar_job_suggestions" USING btree ("job_id");