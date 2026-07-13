CREATE TABLE "meal_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"day" text NOT NULL,
	"name" text NOT NULL,
	"calories" integer DEFAULT 0 NOT NULL,
	"protein_g" real DEFAULT 0 NOT NULL,
	"fat_g" real DEFAULT 0 NOT NULL,
	"carb_g" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "meal_logs_user_id_idx" ON "meal_logs" USING btree ("user_id");