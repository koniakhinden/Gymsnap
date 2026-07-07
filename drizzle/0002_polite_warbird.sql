CREATE TABLE "sync_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gyms" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "quick_workouts" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "weeks" ADD COLUMN "user_id" text;--> statement-breakpoint
UPDATE "gyms" SET "user_id" = 'legacy' WHERE "user_id" IS NULL;--> statement-breakpoint
UPDATE "profiles" SET "user_id" = 'legacy' WHERE "user_id" IS NULL;--> statement-breakpoint
UPDATE "quick_workouts" SET "user_id" = 'legacy' WHERE "user_id" IS NULL;--> statement-breakpoint
UPDATE "weeks" SET "user_id" = 'legacy' WHERE "user_id" IS NULL;--> statement-breakpoint
ALTER TABLE "gyms" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "quick_workouts" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "weeks" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "gyms_user_id_idx" ON "gyms" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "profiles_user_id_idx" ON "profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "quick_workouts_user_id_idx" ON "quick_workouts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "weeks_user_id_idx" ON "weeks" USING btree ("user_id");
