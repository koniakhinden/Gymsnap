CREATE TABLE "exercise_image_specs" (
	"exercise_id" text PRIMARY KEY NOT NULL,
	"phases" integer NOT NULL,
	"camera" text NOT NULL,
	"panel_descriptions" jsonb NOT NULL,
	"figure" text NOT NULL,
	"template_version" integer DEFAULT 1 NOT NULL,
	"edited_by_hand" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercise_images" (
	"id" text PRIMARY KEY NOT NULL,
	"exercise_id" text NOT NULL,
	"url" text NOT NULL,
	"blob_pathname" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"source" text DEFAULT 'generated' NOT NULL,
	"model" text,
	"prompt" text,
	"prompt_hash" text,
	"width" integer,
	"height" integer,
	"bytes" integer,
	"version" integer DEFAULT 1 NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exercise_image_specs" ADD CONSTRAINT "exercise_image_specs_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_images" ADD CONSTRAINT "exercise_images_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exercise_images_exercise_idx" ON "exercise_images" USING btree ("exercise_id");--> statement-breakpoint
CREATE INDEX "exercise_images_status_idx" ON "exercise_images" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_images_one_active_idx" ON "exercise_images" USING btree ("exercise_id") WHERE status = 'active';