CREATE TABLE `daily_steps` (
	`local_date` text PRIMARY KEY NOT NULL,
	`steps` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `imports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`file_name` text NOT NULL,
	`sha256` text NOT NULL,
	`imported_at` text NOT NULL,
	`rows_read` integer NOT NULL,
	`rows_written` integer NOT NULL,
	`warnings` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `imports_source_sha` ON `imports` (`source`,`sha256`);--> statement-breakpoint
CREATE TABLE `meals` (
	`local_date` text NOT NULL,
	`meal` text NOT NULL,
	`kcal` real NOT NULL,
	`protein_g` real NOT NULL,
	`carbs_g` real NOT NULL,
	`fat_g` real NOT NULL,
	`sat_fat_g` real,
	`fiber_g` real,
	`sugar_g` real,
	`sodium_mg` real,
	`potassium_mg` real,
	`cholesterol_mg` real,
	PRIMARY KEY(`local_date`, `meal`)
);
--> statement-breakpoint
CREATE TABLE `set_corrections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workout_start` text NOT NULL,
	`exercise_raw` text NOT NULL,
	`set_type` text NOT NULL,
	`set_index` integer NOT NULL,
	`action` text NOT NULL,
	`weight_kg` real,
	`reason` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `set_corrections_nk` ON `set_corrections` (`workout_start`,`exercise_raw`,`set_type`,`set_index`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `weigh_ins` (
	`local_date` text PRIMARY KEY NOT NULL,
	`weight_kg` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workout_sets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workout_start` text NOT NULL,
	`local_date` text NOT NULL,
	`workout_name` text NOT NULL,
	`workout_duration_s` integer,
	`exercise_raw` text NOT NULL,
	`exercise_id` text NOT NULL,
	`set_index` integer NOT NULL,
	`set_type` text NOT NULL,
	`weight_kg` real,
	`reps` integer,
	`distance_m` real,
	`duration_s` real,
	`notes` text,
	`flag_reason` text,
	`corrected` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workout_sets_nk` ON `workout_sets` (`workout_start`,`exercise_raw`,`set_type`,`set_index`);--> statement-breakpoint
CREATE INDEX `workout_sets_date` ON `workout_sets` (`local_date`);