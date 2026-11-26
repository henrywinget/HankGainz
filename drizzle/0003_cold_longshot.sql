CREATE TABLE `phases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`note` text,
	`rate_min_pct_per_month` real,
	`rate_max_pct_per_month` real,
	`protein_min_g_per_kg` real,
	`protein_max_g_per_kg` real
);
--> statement-breakpoint
CREATE INDEX `phases_start` ON `phases` (`start_date`);