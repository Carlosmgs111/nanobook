import { integer, index, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "../../../../auth/server/infrastructure/better-auth/DrizzleAuthSchema";

export const nanobook = sqliteTable(
  "nanobook",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    visibility: text("visibility", { enum: ["public", "private"] })
      .notNull()
      .default("private"),
    settingsJson: text("settings_json").notNull().default("{}"),
    setupStatus: text("setup_status", { enum: ["pending", "ready", "failed"] })
      .notNull()
      .default("ready"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("nanobook_owner_idx").on(table.ownerId)],
);
