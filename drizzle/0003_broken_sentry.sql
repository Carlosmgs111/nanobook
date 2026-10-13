CREATE TABLE `document` (
	`id` text PRIMARY KEY NOT NULL,
	`nanobook_id` text NOT NULL,
	`path` text NOT NULL,
	`public_path` text NOT NULL,
	`parent_path` text,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`body` text NOT NULL,
	`metadata_json` text NOT NULL,
	`raw_frontmatter` text NOT NULL,
	`owner_id` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`content_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`nanobook_id`) REFERENCES `nanobook`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_live_path_unique` ON `document` (`nanobook_id`,`path`);--> statement-breakpoint
CREATE UNIQUE INDEX `document_live_public_path_unique` ON `document` (`nanobook_id`,`public_path`);--> statement-breakpoint
CREATE INDEX `document_children_idx` ON `document` (`nanobook_id`,`parent_path`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `document_owner_idx` ON `document` (`owner_id`,`nanobook_id`);