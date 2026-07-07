CREATE TABLE "exercise_set_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"set_number" integer NOT NULL,
	"weight" real,
	"weight_unit" text NOT NULL,
	"reps" integer,
	"to_failure" boolean DEFAULT false NOT NULL,
	"logged_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exercise_set_logs" ADD CONSTRAINT "exercise_set_logs_entry_id_exercise_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."exercise_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exercise_set_logs_user_id_idx" ON "exercise_set_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "exercise_set_logs_entry_id_idx" ON "exercise_set_logs" USING btree ("entry_id");