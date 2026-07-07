CREATE TABLE `checkins` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week_id` integer NOT NULL,
	`overall_comment` text DEFAULT '',
	`wellbeing` integer NOT NULL,
	`knees_rating` integer NOT NULL,
	`lower_back_rating` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`week_id`) REFERENCES `weeks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `day_checkins` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`checkin_id` integer NOT NULL,
	`day_id` integer NOT NULL,
	`status` text NOT NULL,
	FOREIGN KEY (`checkin_id`) REFERENCES `checkins`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`day_id`) REFERENCES `days`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `days` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week_id` integer NOT NULL,
	`order_index` integer NOT NULL,
	`day_label` text NOT NULL,
	`focus` text NOT NULL,
	`warmup` text DEFAULT '' NOT NULL,
	`cooldown` text DEFAULT '' NOT NULL,
	`cardio_type` text,
	`cardio_duration_min` integer,
	`cardio_incline` text,
	`cardio_target_hr` text,
	FOREIGN KEY (`week_id`) REFERENCES `weeks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `equipment_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gym_id` integer NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`details` text DEFAULT '',
	`confidence` text NOT NULL,
	`source` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`gym_id`) REFERENCES `gyms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `exercise_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`day_id` integer NOT NULL,
	`order_index` integer NOT NULL,
	`exercise_id` text,
	`name_override` text,
	`sets` integer NOT NULL,
	`reps` text NOT NULL,
	`weight` text DEFAULT '' NOT NULL,
	`rest_sec` integer DEFAULT 60 NOT NULL,
	`notes` text DEFAULT '',
	`unverified` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`day_id`) REFERENCES `days`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`equipment` text,
	`category` text,
	`level` text,
	`force` text,
	`mechanic` text,
	`primary_muscles` text DEFAULT '[]' NOT NULL,
	`secondary_muscles` text DEFAULT '[]' NOT NULL,
	`instructions` text DEFAULT '[]' NOT NULL,
	`images` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `gym_photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`gym_id` integer NOT NULL,
	`filename` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`gym_id`) REFERENCES `gyms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `gyms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`age_group` text NOT NULL,
	`body_weight` real NOT NULL,
	`weight_unit` text NOT NULL,
	`sex` text NOT NULL,
	`experience` text NOT NULL,
	`goal` text NOT NULL,
	`days_per_week` integer NOT NULL,
	`session_length` text NOT NULL,
	`injuries_text` text DEFAULT '',
	`injury_knees` integer DEFAULT false NOT NULL,
	`injury_lower_back` integer DEFAULT false NOT NULL,
	`injury_shoulders` integer DEFAULT false NOT NULL,
	`cardio_incline` integer DEFAULT false NOT NULL,
	`cardio_running` integer DEFAULT false NOT NULL,
	`cardio_bike` integer DEFAULT false NOT NULL,
	`cardio_elliptical` integer DEFAULT false NOT NULL,
	`cardio_minimal` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `weeks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week_number` integer NOT NULL,
	`created_at` text NOT NULL
);
