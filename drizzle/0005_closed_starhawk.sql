CREATE TYPE "public"."cover_letter_tone" AS ENUM('PROFESSIONAL', 'EXECUTIVE', 'CONCISE', 'TECHNICAL');--> statement-breakpoint
CREATE TABLE "cover_letters" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"job_id" text NOT NULL,
	"tone" "cover_letter_tone" DEFAULT 'PROFESSIONAL' NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"ai_model" text NOT NULL,
	"ai_prompt_version" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cover_letters" ADD CONSTRAINT "cover_letters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cover_letters" ADD CONSTRAINT "cover_letters_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cover_letters_user_idx" ON "cover_letters" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cover_letters_job_idx" ON "cover_letters" USING btree ("job_id");