import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

import { createDatabase } from "../../../../shared/infrastructure/database/createDatabase";
import { Nanobook } from "../../domain/Nanobook";
import { DrizzleNanobookRepository } from "./DrizzleNanobookRepository";

describe("DrizzleNanobookRepository", () => {
  let connection: ReturnType<typeof createDatabase>;
  let repository: DrizzleNanobookRepository;

  beforeEach(async () => {
    connection = createDatabase({ url: ":memory:" });
    await connection.db.run(sql`PRAGMA foreign_keys = ON`);
    await connection.db.run(sql`CREATE TABLE user (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, email_verified INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0)`);
    await connection.db.run(sql`CREATE TABLE nanobook (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, visibility TEXT NOT NULL DEFAULT 'private', settings_json TEXT NOT NULL DEFAULT '{}', content_version INTEGER NOT NULL DEFAULT 0, setup_status TEXT NOT NULL DEFAULT 'ready', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`);
    await connection.db.run(sql`INSERT INTO user (id, name, email) VALUES ('user-1', 'User', 'user@example.com')`);
    repository = new DrizzleNanobookRepository(connection.db);
  });

  afterEach(() => connection.client.close());

  it("persists and lists a nanobook by owner", async () => {
    const book = Nanobook.create({ id: "book-1", ownerId: "user-1", slug: "manual", name: "Manual" }).getValue();
    expect((await repository.create(book)).isSuccess).toBe(true);
    expect((await repository.findBySlug("MANUAL")).getValue()?.getId()).toBe("book-1");
    expect((await repository.listByOwner("user-1")).getValue()).toHaveLength(1);
  });

  it("rejects duplicate slugs and users that do not exist", async () => {
    const first = Nanobook.create({ id: "book-1", ownerId: "user-1", slug: "manual", name: "Manual" }).getValue();
    const duplicate = Nanobook.create({ id: "book-2", ownerId: "user-1", slug: "manual", name: "Otro" }).getValue();
    const missingOwner = Nanobook.create({ id: "book-3", ownerId: "missing", slug: "otro", name: "Otro" }).getValue();

    expect((await repository.create(first)).isSuccess).toBe(true);
    expect((await repository.create(duplicate)).getError().name).toBe("NanobookSlugAlreadyTakenError");
    expect((await repository.create(missingOwner)).isSuccess).toBe(false);
  });

  it("persists setup status changes", async () => {
    const book = Nanobook.create({
      id: "book-1",
      ownerId: "user-1",
      slug: "manual",
      name: "Manual",
      setupStatus: "pending",
    }).getValue();

    expect((await repository.create(book)).isSuccess).toBe(true);
    const update = await repository.updateSetupStatus("book-1", "failed");

    expect(update.isSuccess).toBe(true);
    expect((await repository.findById("book-1")).getValue()?.getSetupStatus()).toBe("failed");

    const missing = await repository.updateSetupStatus("missing", "ready");
    expect(missing.isSuccess).toBe(false);
    expect(missing.getError().name).toBe("NanobookRepositoryError");
  });
});
