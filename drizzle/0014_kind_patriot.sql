ALTER TABLE "exercise_images" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "exercise_images" ADD COLUMN "quality" text;