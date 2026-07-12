ALTER TABLE "days" ADD COLUMN "warmup_items" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "weeks" ADD COLUMN "stretch_blocks" jsonb DEFAULT '[]'::jsonb NOT NULL;