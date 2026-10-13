import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { nanobook } from "./DrizzleNanobookSchema";

export const nanobookAlias = sqliteTable("nanobook_alias", {
  legacyPath: text("legacy_path").primaryKey(),
  nanobookId: text("nanobook_id")
    .notNull()
    .references(() => nanobook.id, { onDelete: "cascade" }),
  targetPath: text("target_path").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});
