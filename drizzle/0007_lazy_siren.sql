CREATE TABLE "linkedin_optimizations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"ai_model" text NOT NULL,
	"ai_prompt_version" text NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "linkedin_optimizations" ADD CONSTRAINT "linkedin_optimizations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "linkedin_optimizations_user_idx" ON "linkedin_optimizations" USING btree ("user_id");