import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";

export const agentOperationAudit = sqliteTable(
  "agent_operation_audit",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").notNull(),
    oauthClientId: text("oauth_client_id").notNull(),
    toolName: text("tool_name").notNull(),
    nanobookId: text("nanobook_id").notNull(),
    documentId: text("document_id"),
    requestId: text("request_id").notNull(),
    occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("agent_operation_audit_actor_idx").on(table.actorId)]
);
