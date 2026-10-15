import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

import { createDatabase } from "../../../../shared/infrastructure/database/createDatabase";
import { Theme } from "../../domain/Theme";
import { DrizzleThemeRepository } from "./DrizzleThemeRepository";

const makeTheme = (id: string, ownerId = "owner-1", name = "Editorial") => Theme.create({
  id, ownerId, name, baseThemeId: "nanobook", tokens: { light: { accent: "#3159d8" } },
}).getValue();

describe("DrizzleThemeRepository", () => {
  let connection: ReturnType<typeof createDatabase>;
  let repository: DrizzleThemeRepository;

  beforeEach(async () => {
    connection = createDatabase({ url: ":memory:" });
    await connection.db.run(sql`CREATE TABLE theme (id TEXT PRIMARY KEY NOT NULL, owner_id TEXT NOT NULL, name TEXT NOT NULL, base_theme_id TEXT NOT NULL, tokens_json TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`);
    await connection.db.run(sql`CREATE INDEX theme_owner_idx ON theme (owner_id)`);
    repository = new DrizzleThemeRepository(connection.db);
  });

  afterEach(() => connection.client.close());

  it("creates, reads and lists themes within the requested owner", async () => {
    expect((await repository.create(makeTheme("one"))).isSuccess).toBe(true);
    expect((await repository.create(makeTheme("two", "owner-2"))).isSuccess).toBe(true);
    expect((await repository.findByOwner("owner-1", "one")).getValue()?.getTokens()).toEqual({ light: { accent: "#3159d8" } });
    expect((await repository.findByOwner("owner-2", "one")).getValue()).toBeNull();
    expect((await repository.listByOwner("owner-1")).getValue().map((item) => item.getId())).toEqual(["one"]);
  });

  it("updates a theme without crossing owner boundaries", async () => {
    await repository.create(makeTheme("one"));
    expect((await repository.update(makeTheme("one", "owner-2", "Intruso"))).isSuccess).toBe(false);
    expect((await repository.update(makeTheme("one", "owner-1", "Renombrado"))).isSuccess).toBe(true);
    expect((await repository.findByOwner("owner-1", "one")).getValue()?.getName()).toBe("Renombrado");
  });

  it("reports duplicate IDs and corrupt token JSON as repository errors", async () => {
    await repository.create(makeTheme("one"));
    expect((await repository.create(makeTheme("one"))).isSuccess).toBe(false);
    await connection.db.run(sql`UPDATE theme SET tokens_json = '{' WHERE id = 'one'`);
    const corrupt = await repository.findById("one");
    expect(corrupt.isSuccess).toBe(false);
    expect(corrupt.getError().name).toBe("ThemeRepositoryError");
  });
});
