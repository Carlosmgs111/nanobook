import { relations, sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .default(false)
    .notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const rateLimit = sqliteTable("rateLimit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: integer("lastRequest").notNull(),
});

export const jwks = sqliteTable("jwks", {
  id: text("id").primaryKey(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  alg: text("alg"),
  crv: text("crv"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
});

const stringArray = () => text({ mode: "json" }).$type<string[]>();
const jsonValue = () => text({ mode: "json" }).$type<Record<string, unknown>>();
const timestamp = () => integer({ mode: "timestamp_ms" });

export const oauthClient = sqliteTable("oauthClient", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull().unique(),
  clientSecret: text("client_secret"), clientDiscoveryId: text("client_discovery_id"),
  disabled: integer("disabled", { mode: "boolean" }).default(false),
  skipConsent: integer("skip_consent", { mode: "boolean" }),
  enableEndSession: integer("enable_end_session", { mode: "boolean" }),
  subjectType: text("subject_type"), scopes: stringArray("scopes"),
  clientCredentialsScopes: stringArray("client_credentials_scopes").default([]),
  userId: text("user_id").references(() => user.id),
  createdAt: timestamp("created_at"), updatedAt: timestamp("updated_at"),
  name: text("name"), uri: text("uri"), icon: text("icon"), contacts: stringArray("contacts"),
  tos: text("tos"), policy: text("policy"), softwareId: text("software_id"),
  softwareVersion: text("software_version"), softwareStatement: text("software_statement"),
  redirectUris: stringArray("redirect_uris").notNull(),
  postLogoutRedirectUris: stringArray("post_logout_redirect_uris"),
  backchannelLogoutUri: text("backchannel_logout_uri"),
  backchannelLogoutSessionRequired: integer("backchannel_logout_session_required", { mode: "boolean" }),
  tokenEndpointAuthMethod: text("token_endpoint_auth_method"), applicationType: text("application_type"),
  jwks: text("jwks"), jwksUri: text("jwks_uri"), grantTypes: stringArray("grant_types"),
  responseTypes: stringArray("response_types"), requirePKCE: integer("require_pkce", { mode: "boolean" }),
  dpopBoundAccessTokens: integer("dpop_bound_access_tokens", { mode: "boolean" }).default(false),
  referenceId: text("reference_id"), metadata: jsonValue("metadata"),
}, (table) => [index("oauthClient_userId_idx").on(table.userId)]);

export const oauthResource = sqliteTable("oauthResource", {
  id: text("id").primaryKey(), identifier: text("identifier").notNull().unique(), name: text("name").notNull(),
  accessTokenTtl: integer("access_token_ttl"), refreshTokenTtl: integer("refresh_token_ttl"),
  signingAlgorithm: text("signing_algorithm"), signingKeyId: text("signing_key_id"),
  allowedScopes: stringArray("allowed_scopes"), customClaims: jsonValue("custom_claims"),
  dpopBoundAccessTokensRequired: integer("dpop_bound_access_tokens_required", { mode: "boolean" }).default(false),
  disabled: integer("disabled", { mode: "boolean" }).default(false), createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"), policyVersion: integer("policy_version").default(1), metadata: jsonValue("metadata"),
});

export const oauthClientResource = sqliteTable("oauthClientResource", {
  id: text("id").primaryKey(), clientId: text("client_id").notNull().references(() => oauthClient.clientId, { onDelete: "cascade" }),
  resourceId: text("resource_id").notNull().references(() => oauthResource.identifier, { onDelete: "cascade" }),
  metadata: jsonValue("metadata"), createdAt: timestamp("created_at"),
}, (table) => [index("oauthClientResource_clientId_idx").on(table.clientId), index("oauthClientResource_resourceId_idx").on(table.resourceId), index("oauthClientResource_client_resource_idx").on(table.clientId, table.resourceId)]);

export const oauthRefreshToken = sqliteTable("oauthRefreshToken", {
  id: text("id").primaryKey(), token: text("token").notNull().unique(), clientId: text("client_id").notNull().references(() => oauthClient.clientId),
  sessionId: text("session_id").references(() => session.id, { onDelete: "set null" }), userId: text("user_id").notNull().references(() => user.id),
  referenceId: text("reference_id"), authorizationCodeId: text("authorization_code_id"), resources: stringArray("resources"), requestedUserInfoClaims: stringArray("requested_user_info_claims"),
  expiresAt: timestamp("expires_at").notNull(), createdAt: timestamp("created_at").notNull(), revoked: timestamp("revoked"), rotatedAt: timestamp("rotated_at"),
  rotationReplayResponse: text("rotation_replay_response"), rotationReplayExpiresAt: timestamp("rotation_replay_expires_at"), authTime: timestamp("auth_time"), confirmation: jsonValue("confirmation"), scopes: stringArray("scopes").notNull(),
}, (table) => [index("oauthRefreshToken_clientId_idx").on(table.clientId), index("oauthRefreshToken_sessionId_idx").on(table.sessionId), index("oauthRefreshToken_userId_idx").on(table.userId), index("oauthRefreshToken_authorizationCodeId_idx").on(table.authorizationCodeId)]);

export const oauthAccessToken = sqliteTable("oauthAccessToken", {
  id: text("id").primaryKey(), token: text("token").unique(), clientId: text("client_id").notNull().references(() => oauthClient.clientId),
  sessionId: text("session_id").references(() => session.id, { onDelete: "set null" }), userId: text("user_id").references(() => user.id),
  referenceId: text("reference_id"), authorizationCodeId: text("authorization_code_id"), resources: stringArray("resources"), requestedUserInfoClaims: stringArray("requested_user_info_claims"), refreshId: text("refresh_id").references(() => oauthRefreshToken.id),
  expiresAt: timestamp("expires_at").notNull(), createdAt: timestamp("created_at").notNull(), revoked: timestamp("revoked"), confirmation: jsonValue("confirmation"), scopes: stringArray("scopes").notNull(),
}, (table) => [index("oauthAccessToken_clientId_idx").on(table.clientId), index("oauthAccessToken_sessionId_idx").on(table.sessionId), index("oauthAccessToken_userId_idx").on(table.userId), index("oauthAccessToken_authorizationCodeId_idx").on(table.authorizationCodeId), index("oauthAccessToken_refreshId_idx").on(table.refreshId)]);

export const oauthConsent = sqliteTable("oauthConsent", {
  id: text("id").primaryKey(), clientId: text("client_id").notNull().references(() => oauthClient.clientId), userId: text("user_id").references(() => user.id), referenceId: text("reference_id"),
  resources: stringArray("resources"), requestedUserInfoClaims: stringArray("requested_user_info_claims"), scopes: stringArray("scopes").notNull(), createdAt: timestamp("created_at").notNull(), updatedAt: timestamp("updated_at").notNull(),
}, (table) => [index("oauthConsent_clientId_idx").on(table.clientId), index("oauthConsent_userId_idx").on(table.userId)]);

export const oauthClientAssertion = sqliteTable("oauthClientAssertion", { id: text("id").primaryKey(), expiresAt: timestamp("expires_at").notNull() });

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));
