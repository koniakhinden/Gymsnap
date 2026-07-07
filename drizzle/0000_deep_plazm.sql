CREATE TABLE "checkins" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_id" integer NOT NULL,
	"overall_comment" text DEFAULT '',
	"wellbeing" integer NOT NULL,
	"knees_rating" integer NOT NULL,
	"lower_back_rating" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "day_checkins" (
	"id" serial PRIMARY KEY NOT NULL,
	"checkin_id" integer NOT NULL,
	"day_id" integer NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "days" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_id" integer NOT NULL,
	"order_index" integer NOT NULL,
	"day_label" text NOT NULL,
	"focus" text NOT NULL,
	"warmup" text DEFAULT '' NOT NULL,
	"cooldown" text DEFAULT '' NOT NULL,
	"cardio_type" text,
	"cardio_duration_min" integer,
	"cardio_incline" text,
	"cardio_target_hr" text
);
--> statement-breakpoint
CREATE TABLE "equipment_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"gym_id" integer NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"details" text DEFAULT '',
	"confidence" text NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercise_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"day_id" integer NOT NULL,
	"order_index" integer NOT NULL,
	"exercise_id" text,
	"name_override" text,
	"sets" integer NOT NULL,
	"reps" text NOT NULL,
	"weight" text DEFAULT '' NOT NULL,
	"rest_sec" integer DEFAULT 60 NOT NULL,
	"notes" text DEFAULT '',
	"unverified" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"equipment" text,
	"category" text,
	"level" text,
	"force" text,
	"mechanic" text,
	"primary_muscles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"secondary_muscles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"instructions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gym_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"gym_id" integer NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gyms" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"age_group" text NOT NULL,
	"body_weight" real NOT NULL,
	"weight_unit" text NOT NULL,
	"sex" text NOT NULL,
	"experience" text NOT NULL,
	"goal" text NOT NULL,
	"days_per_week" integer NOT NULL,
	"session_length" text NOT NULL,
	"injuries_text" text DEFAULT '',
	"injury_knees" boolean DEFAULT false NOT NULL,
	"injury_lower_back" boolean DEFAULT false NOT NULL,
	"injury_shoulders" boolean DEFAULT false NOT NULL,
	"cardio_incline" boolean DEFAULT false NOT NULL,
	"cardio_running" boolean DEFAULT false NOT NULL,
	"cardio_bike" boolean DEFAULT false NOT NULL,
	"cardio_elliptical" boolean DEFAULT false NOT NULL,
	"cardio_minimal" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weeks" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_number" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."weeks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_checkins" ADD CONSTRAINT "day_checkins_checkin_id_checkins_id_fk" FOREIGN KEY ("checkin_id") REFERENCES "public"."checkins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_checkins" ADD CONSTRAINT "day_checkins_day_id_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "days" ADD CONSTRAINT "days_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."weeks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_items" ADD CONSTRAINT "equipment_items_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_entries" ADD CONSTRAINT "exercise_entries_day_id_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_entries" ADD CONSTRAINT "exercise_entries_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gym_photos" ADD CONSTRAINT "gym_photos_gym_id_gyms_id_fk" FOREIGN KEY ("gym_id") REFERENCES "public"."gyms"("id") ON DELETE cascade ON UPDATE no action;