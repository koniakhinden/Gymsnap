CREATE TABLE "quick_workouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"equipment_mode" text NOT NULL,
	"equipment" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"focus_chips" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"focus_text" text DEFAULT '' NOT NULL,
	"time_min" integer NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
