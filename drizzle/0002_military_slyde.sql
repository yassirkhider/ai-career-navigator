CREATE TYPE "public"."application_status" AS ENUM('SAVED', 'PREPARING', 'READY_TO_APPLY', 'APPLIED', 'RECRUITER_CONTACT', 'INTERVIEW', 'ASSESSMENT', 'OFFER', 'REJECTED', 'WITHDRAWN', 'ACCEPTED');--> statement-breakpoint
CREATE TABLE "applications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"job_id" text,
	"job_title" text NOT NULL,
	"company" text,
	"status" "application_status" DEFAULT 'SAVED' NOT NULL,
	"cv_version_label" text,
	"cover_letter_notes" text,
	"date_applied" timestamp,
	"contact_name" text,
	"contact_email" text,
	"interview_date" timestamp,
	"follow_up_date" timestamp,
	"notes" text,
	"outcome" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "applications_user_idx" ON "applications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "applications_job_idx" ON "applications" USING btree ("job_id");