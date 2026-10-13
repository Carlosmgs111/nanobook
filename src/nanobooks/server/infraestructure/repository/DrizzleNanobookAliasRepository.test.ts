import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

import { createDatabase } from "../../../../shared/infrastructure/database/createDatabase";
import { DrizzleNanobookAliasRepository } from "./DrizzleNanobookAliasRepository";

describe("DrizzleNanobookAliasRepository", () => {
  let connection: ReturnType<typeof createDatabase>;
  let repository: DrizzleNanobookAliasRepository;

  beforeEach(async () => {
    connection = createDatabase({ url: ":memory:" });
    await connection.db.run(sql`CREATE TABLE nanobook (id TEXT PRIMARY KEY)`);
    await connection.db.run(sql`CREATE TABLE nanobook_alias (legacy_path TEXT PRIMARY KEY NOT NULL, nanobook_id TEXT NOT NULL REFERENCES nanobook(id), target_path TEXT NOT NULL, created_at INTEGER NOT NULL)`);
    await connection.db.run(sql`INSERT INTO nanobook (id) VALUES ('book-1')`);
    await connection.db.run(sql`INSERT INTO nanobook_alias (legacy_path, nanobook_id, target_path, created_at) VALUES ('guide/intro', 'book-1', 'intro', 0)`);
    repository = new DrizzleNanobookAliasRepository(connection.db);
  });

  afterEach(() => connection.client.close());

  it("normalizes a legacy path before resolving its destination", async () => {
    const result = await repository.findByLegacyPath("/guide/intro/");

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toEqual({
      legacyPath: "guide/intro",
      nanobookId: "book-1",
      targetPath: "intro",
    });
  });

  it("reports when the aliases migration has not been applied", async () => {
    const connectionWithoutAliases = createDatabase({ url: ":memory:" });
    await connectionWithoutAliases.db.run(sql`CREATE TABLE nanobook (id TEXT PRIMARY KEY)`);
    const repositoryWithoutAliases = new DrizzleNanobookAliasRepository(connectionWithoutAliases.db);

    const result = await repositoryWithoutAliases.findByLegacyPath("guide/intro");

    expect(result.isSuccess).toBe(false);
    if (!result.isSuccess) {
      expect(result.getError().message).toContain("npm run database:migrate");
    }
    connectionWithoutAliases.client.close();
  });
});
