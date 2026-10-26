CREATE TABLE `oauthAccessToken` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text,
	`client_id` text NOT NULL,
	`session_id` text,
	`user_id` text,
	`reference_id` text,
	`authorization_code_id` text,
	`resources` text,
	`requestedUserInfoClaims` text,
	`refresh_id` text,
	`expiresAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`revoked` integer,
	`confirmation` text,
	`scopes` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `oauthClient`(`client_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`refresh_id`) REFERENCES `oauthRefreshToken`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauthAccessToken_token_unique` ON `oauthAccessToken` (`token`);--> statement-breakpoint
CREATE INDEX `oauthAccessToken_clientId_idx` ON `oauthAccessToken` (`client_id`);--> statement-breakpoint
CREATE INDEX `oauthAccessToken_sessionId_idx` ON `oauthAccessToken` (`session_id`);--> statement-breakpoint
CREATE INDEX `oauthAccessToken_userId_idx` ON `oauthAccessToken` (`user_id`);--> statement-breakpoint
CREATE INDEX `oauthAccessToken_authorizationCodeId_idx` ON `oauthAccessToken` (`authorization_code_id`);--> statement-breakpoint
CREATE INDEX `oauthAccessToken_refreshId_idx` ON `oauthAccessToken` (`refresh_id`);--> statement-breakpoint
CREATE TABLE `oauthClient` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`client_secret` text,
	`client_discovery_id` text,
	`disabled` integer DEFAULT false,
	`skip_consent` integer,
	`enable_end_session` integer,
	`subject_type` text,
	`scopes` text,
	`clientCredentialsScopes` text DEFAULT '[]',
	`user_id` text,
	`createdAt` integer,
	`updatedAt` integer,
	`name` text,
	`uri` text,
	`icon` text,
	`contacts` text,
	`tos` text,
	`policy` text,
	`software_id` text,
	`software_version` text,
	`software_statement` text,
	`redirectUris` text NOT NULL,
	`postLogoutRedirectUris` text,
	`backchannel_logout_uri` text,
	`backchannel_logout_session_required` integer,
	`token_endpoint_auth_method` text,
	`application_type` text,
	`jwks` text,
	`jwks_uri` text,
	`grantTypes` text,
	`responseTypes` text,
	`require_pkce` integer,
	`dpop_bound_access_tokens` integer DEFAULT false,
	`reference_id` text,
	`metadata` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauthClient_client_id_unique` ON `oauthClient` (`client_id`);--> statement-breakpoint
CREATE INDEX `oauthClient_userId_idx` ON `oauthClient` (`user_id`);--> statement-breakpoint
CREATE TABLE `oauthClientAssertion` (
	`id` text PRIMARY KEY NOT NULL,
	`expiresAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `oauthClientResource` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`resource_id` text NOT NULL,
	`metadata` text,
	`createdAt` integer,
	FOREIGN KEY (`client_id`) REFERENCES `oauthClient`(`client_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resource_id`) REFERENCES `oauthResource`(`identifier`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `oauthClientResource_clientId_idx` ON `oauthClientResource` (`client_id`);--> statement-breakpoint
CREATE INDEX `oauthClientResource_resourceId_idx` ON `oauthClientResource` (`resource_id`);--> statement-breakpoint
CREATE INDEX `oauthClientResource_client_resource_idx` ON `oauthClientResource` (`client_id`,`resource_id`);--> statement-breakpoint
CREATE TABLE `oauthConsent` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`user_id` text,
	`reference_id` text,
	`resources` text,
	`requestedUserInfoClaims` text,
	`scopes` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `oauthClient`(`client_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `oauthConsent_clientId_idx` ON `oauthConsent` (`client_id`);--> statement-breakpoint
CREATE INDEX `oauthConsent_userId_idx` ON `oauthConsent` (`user_id`);--> statement-breakpoint
CREATE TABLE `oauthRefreshToken` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`client_id` text NOT NULL,
	`session_id` text,
	`user_id` text NOT NULL,
	`reference_id` text,
	`authorization_code_id` text,
	`resources` text,
	`requestedUserInfoClaims` text,
	`expiresAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`revoked` integer,
	`rotatedAt` integer,
	`rotation_replay_response` text,
	`rotationReplayExpiresAt` integer,
	`authTime` integer,
	`confirmation` text,
	`scopes` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `oauthClient`(`client_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauthRefreshToken_token_unique` ON `oauthRefreshToken` (`token`);--> statement-breakpoint
CREATE INDEX `oauthRefreshToken_clientId_idx` ON `oauthRefreshToken` (`client_id`);--> statement-breakpoint
CREATE INDEX `oauthRefreshToken_sessionId_idx` ON `oauthRefreshToken` (`session_id`);--> statement-breakpoint
CREATE INDEX `oauthRefreshToken_userId_idx` ON `oauthRefreshToken` (`user_id`);--> statement-breakpoint
CREATE INDEX `oauthRefreshToken_authorizationCodeId_idx` ON `oauthRefreshToken` (`authorization_code_id`);--> statement-breakpoint
CREATE TABLE `oauthResource` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`name` text NOT NULL,
	`access_token_ttl` integer,
	`refresh_token_ttl` integer,
	`signing_algorithm` text,
	`signing_key_id` text,
	`allowedScopes` text,
	`customClaims` text,
	`dpop_bound_access_tokens_required` integer DEFAULT false,
	`disabled` integer DEFAULT false,
	`createdAt` integer,
	`updatedAt` integer,
	`policy_version` integer DEFAULT 1,
	`metadata` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauthResource_identifier_unique` ON `oauthResource` (`identifier`);