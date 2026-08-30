CREATE TABLE "course_recommendation_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"skill_name" text NOT NULL,
	"ai_model" text NOT NULL,
	"ai_prompt_version" text NOT NULL,
	"recommendations" jsonb NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"last_verified_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "course_recommendation_batches" ADD CONSTRAINT "course_recommendation_batches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "course_recommendation_batches_user_idx" ON "course_recommendation_batches" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "course_recommendation_batches_skill_idx" ON "course_recommendation_batches" USING btree ("skill_name");