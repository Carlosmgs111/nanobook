CREATE TABLE `nanobook_alias` (
	`legacy_path` text PRIMARY KEY NOT NULL,
	`nanobook_id` text NOT NULL,
	`target_path` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`nanobook_id`) REFERENCES `nanobook`(`id`) ON UPDATE no action ON DELETE cascade
);
