CREATE TABLE "eaters" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"is_self" boolean DEFAULT false NOT NULL,
	"sex" text NOT NULL,
	"age_years" integer NOT NULL,
	"height_cm" real NOT NULL,
	"weight_kg" real NOT NULL,
	"activity" text NOT NULL,
	"goal" text NOT NULL,
	"dietary" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"allergies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nutrition_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"country" text DEFAULT '' NOT NULL,
	"region" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"cuisines" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"likes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dislikes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"budget_level" text,
	"calorie_target_override" integer,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "eaters_user_id_idx" ON "eaters" USING btree ("user_id");