DROP INDEX `workout_sets_nk`;--> statement-breakpoint
ALTER TABLE `workout_sets` ADD `source` text DEFAULT 'strong' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `workout_sets_nk` ON `workout_sets` (`source`,`workout_start`,`exercise_raw`,`set_type`,`set_index`);