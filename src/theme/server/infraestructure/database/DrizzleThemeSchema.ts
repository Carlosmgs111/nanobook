import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const theme = sqliteTable(
  "theme",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    baseThemeId: text("base_theme_id", { enum: ["classic", "nanobook"] }).notNull(),
    tokensJson: text("tokens_json").notNull().default("{}"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("theme_owner_idx").on(table.ownerId)],
);
