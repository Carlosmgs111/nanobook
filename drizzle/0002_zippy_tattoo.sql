CREATE TABLE `nanobook` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`settings_json` text DEFAULT '{}' NOT NULL,
	`content_version` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nanobook_slug_unique` ON `nanobook` (`slug`);--> statement-breakpoint
CREATE INDEX `nanobook_owner_idx` ON `nanobook` (`owner_id`);