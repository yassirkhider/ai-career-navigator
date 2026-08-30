CREATE TABLE "career_path_predictions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"ai_model" text NOT NULL,
	"ai_prompt_version" text NOT NULL,
	"paths" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "career_path_predictions" ADD CONSTRAINT "career_path_predictions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "career_path_predictions_user_idx" ON "career_path_predictions" USING btree ("user_id");