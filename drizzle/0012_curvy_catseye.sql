CREATE TABLE `agent_operation_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`oauth_client_id` text NOT NULL,
	`tool_name` text NOT NULL,
	`nanobook_id` text NOT NULL,
	`document_id` text,
	`request_id` text NOT NULL,
	`occurred_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `agent_operation_audit_actor_idx` ON `agent_operation_audit` (`actor_id`);