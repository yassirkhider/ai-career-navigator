CREATE TYPE "public"."interview_question_type" AS ENUM('TECHNICAL', 'BEHAVIORAL', 'SITUATIONAL', 'STAR', 'ROLE_SPECIFIC', 'GAP_BASED');--> statement-breakpoint
CREATE TABLE "interview_answers" (
	"id" text PRIMARY KEY NOT NULL,
	"question_id" text NOT NULL,
	"user_id" text NOT NULL,
	"answer_text" text NOT NULL,
	"relevance_score" integer NOT NULL,
	"technical_accuracy_score" integer NOT NULL,
	"structure_score" integer NOT NULL,
	"evidence_score" integer NOT NULL,
	"clarity_score" integer NOT NULL,
	"completeness_score" integer NOT NULL,
	"overall_score" integer NOT NULL,
	"feedback" text NOT NULL,
	"improved_answer_guidance" text NOT NULL,
	"ai_model" text NOT NULL,
	"ai_prompt_version" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_questions" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"question_text" text NOT NULL,
	"question_type" "interview_question_type" NOT NULL,
	"order_index" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"job_id" text NOT NULL,
	"ai_model" text NOT NULL,
	"ai_prompt_version" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interview_answers" ADD CONSTRAINT "interview_answers_question_id_interview_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."interview_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_answers" ADD CONSTRAINT "interview_answers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_questions" ADD CONSTRAINT "interview_questions_session_id_interview_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."interview_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interview_answers_question_idx" ON "interview_answers" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "interview_answers_user_idx" ON "interview_answers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "interview_questions_session_idx" ON "interview_questions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "interview_sessions_user_idx" ON "interview_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "interview_sessions_job_idx" ON "interview_sessions" USING btree ("job_id");