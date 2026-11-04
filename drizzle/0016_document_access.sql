CREATE TABLE `document_access` (
	`document_id` text PRIMARY KEY NOT NULL,
	`password_hash` text,
	`password_version` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `document`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `document_unlock_attempt` (
	`document_id` text NOT NULL,
	`client_key` text NOT NULL,
	`window_started_at` integer NOT NULL,
	`failures` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`document_id`, `client_key`),
	FOREIGN KEY (`document_id`) REFERENCES `document`(`id`) ON UPDATE no action ON DELETE cascade
);
