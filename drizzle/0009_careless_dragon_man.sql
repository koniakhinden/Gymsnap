CREATE TABLE "menu_weeks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"week_number" integer NOT NULL,
	"targets" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "menu_weeks_user_id_idx" ON "menu_weeks" USING btree ("user_id");