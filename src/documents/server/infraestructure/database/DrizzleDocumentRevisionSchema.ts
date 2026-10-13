import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { document } from "./DrizzleDocumentSchema";
import { nanobook } from "../../../../nanobooks/server/infraestructure/database/DrizzleNanobookSchema";
import { user } from "../../../../auth/server/infrastructure/better-auth/DrizzleAuthSchema";

export const documentRevision = sqliteTable(
  "document_revision",
  {
    documentId: text("document_id").notNull().references(() => document.id, { onDelete: "restrict" }),
    revision: integer("revision").notNull(),
    snapshotJson: text("snapshot_json").notNull(),
    actorId: text("actor_id").notNull().references(() => user.id, { onDelete: "restrict" }),
    operation: text("operation", { enum: ["import", "create", "update", "move", "delete"] }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.documentId, table.revision] })],
);

export const contentOutbox = sqliteTable("content_outbox", {
  id: text("id").primaryKey(),
  nanobookId: text("nanobook_id").notNull().references(() => nanobook.id, { onDelete: "restrict" }),
  contentVersion: integer("content_version").notNull(),
  eventType: text("event_type").notNull(),
  payloadJson: text("payload_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  deliveredAt: integer("delivered_at", { mode: "timestamp_ms" }),
});
