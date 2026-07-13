CREATE TABLE "quick_meals" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"ingredients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"meal_type" text DEFAULT 'any' NOT NULL,
	"servings" integer DEFAULT 1 NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "quick_meals_user_id_idx" ON "quick_meals" USING btree ("user_id");