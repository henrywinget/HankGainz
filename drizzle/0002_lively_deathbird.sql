CREATE TABLE `digests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week_start` text NOT NULL,
	`input_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`model` text NOT NULL,
	`payload` text NOT NULL,
	`content` text NOT NULL,
	`input_tokens` integer,
	`output_tokens` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `digests_week_hash` ON `digests` (`week_start`,`input_hash`);