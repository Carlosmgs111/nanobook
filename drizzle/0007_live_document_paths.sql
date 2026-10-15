DROP INDEX `document_live_path_unique`;--> statement-breakpoint
DROP INDEX `document_live_public_path_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `document_live_path_unique` ON `document` (`nanobook_id`,`path`) WHERE "document"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX `document_live_public_path_unique` ON `document` (`nanobook_id`,`public_path`) WHERE "document"."deleted_at" is null;