import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { isNull } from "drizzle-orm";

import { nanobook } from "../../../../nanobooks/server/infraestructure/database/DrizzleNanobookSchema";
import { user } from "../../../../auth/server/infrastructure/better-auth/DrizzleAuthSchema";

export const document = sqliteTable(
  "document",
  {
    id: text("id").primaryKey(),
    nanobookId: text("nanobook_id")
      .notNull()
      .references(() => nanobook.id, { onDelete: "restrict" }),
    path: text("path").notNull(),
    publicPath: text("public_path").notNull(),
    parentPath: text("parent_path"),
    title: text("title").notNull(),
    description: text("description").notNull(),
    body: text("body").notNull(),
    metadataJson: text("metadata_json").notNull(),
    rawFrontmatter: text("raw_frontmatter").notNull(),
    ownerId: text("owner_id").references(() => user.id, { onDelete: "restrict" }),
    revision: integer("revision").notNull().default(1),
    contentHash: text("content_hash").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("document_live_path_unique").on(table.nanobookId, table.path).where(isNull(table.deletedAt)),
    uniqueIndex("document_live_public_path_unique").on(table.nanobookId, table.publicPath).where(isNull(table.deletedAt)),
    index("document_children_idx").on(table.nanobookId, table.parentPath, table.deletedAt),
    index("document_owner_idx").on(table.ownerId, table.nanobookId),
  ],
);
