CREATE TABLE "cv_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"job_id" text,
	"target_job_title" text,
	"version_label" text NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"content" jsonb NOT NULL,
	"ai_model" text NOT NULL,
	"ai_prompt_version" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cv_versions" ADD CONSTRAINT "cv_versions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cv_versions" ADD CONSTRAINT "cv_versions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cv_versions_user_idx" ON "cv_versions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cv_versions_job_idx" ON "cv_versions" USING btree ("job_id");