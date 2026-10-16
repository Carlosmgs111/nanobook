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

  it("lists only public ready books and reflects visibility changes immediately", async () => {
    for (const [id, visibility, setupStatus] of [
      ["visible", "public", "ready"], ["secret", "private", "ready"],
      ["pending", "public", "pending"], ["failed", "public", "failed"],
    ] as const) {
      await repository.create(Nanobook.create({ id, ownerId: "user-1", slug: id, name: id, visibility, setupStatus }).getValue());
    }
    expect((await repository.listPublic()).getValue().map(book => book.getSlug())).toEqual(["visible"]);
    const book = (await repository.findById("visible")).getValue()!;
    await repository.update(Nanobook.create({ ...book.toPersistence(), visibility: "private" }).getValue());
    expect((await repository.listPublic()).getValue()).toEqual([]);
  });

  it("updates metadata without overwriting content version", async () => {
    const book = Nanobook.create({ id: "book-1", ownerId: "user-1", slug: "manual", name: "Manual" }).getValue();
    await repository.create(book);
    await connection.db.run(sql`UPDATE nanobook SET content_version = 9 WHERE id = 'book-1'`);
    const updated = Nanobook.create({ ...book.toPersistence(), slug: "new", name: "New", visibility: "public", settings: { theme: { kind: "official", id: "nanobook" } } }).getValue();
    expect((await repository.update(updated)).isSuccess).toBe(true);
    expect((await repository.findBySlug("new")).getValue()?.getContentVersion()).toBe(9);
    expect((await repository.findBySlug("new")).getValue()?.getSettings()).toEqual({ theme: { kind: "official", id: "nanobook" } });
    expect((await repository.findBySlug("manual")).getValue()).toBeNull();
    await repository.create(Nanobook.create({ id: "book-2", ownerId: "user-1", slug: "taken", name: "Other" }).getValue());
    const conflicting = Nanobook.create({ ...updated.toPersistence(), slug: "taken" }).getValue();
    expect((await repository.update(conflicting)).getError().name).toBe("NanobookSlugAlreadyTakenError");
    expect((await repository.findById("book-1")).getValue()?.getSlug()).toBe("new");
  });

  it("deletes related data atomically and preserves other books", async () => {
    await connection.db.run(sql`CREATE TABLE document (id TEXT PRIMARY KEY, nanobook_id TEXT NOT NULL REFERENCES nanobook(id))`);
    await connection.db.run(sql`CREATE TABLE document_revision (document_id TEXT NOT NULL REFERENCES document(id))`);
    await connection.db.run(sql`CREATE TABLE content_outbox (nanobook_id TEXT NOT NULL REFERENCES nanobook(id))`);
    const book = Nanobook.create({ id: "book-1", ownerId: "user-1", slug: "manual", name: "Manual" }).getValue();
    await repository.create(book);
    await repository.create(Nanobook.create({ id: "book-2", ownerId: "user-1", slug: "other", name: "Other" }).getValue());
    await connection.db.run(sql`INSERT INTO document VALUES ('doc-1', 'book-1'), ('doc-2', 'book-2')`);
    await connection.db.run(sql`INSERT INTO document_revision VALUES ('doc-1'), ('doc-2')`);
    await connection.db.run(sql`INSERT INTO content_outbox VALUES ('book-1'), ('book-2')`);
    await connection.db.run(sql`CREATE TRIGGER prevent_delete BEFORE DELETE ON nanobook BEGIN SELECT RAISE(ABORT, 'failure'); END`);
    expect((await repository.delete(book)).isSuccess).toBe(false);
    expect((await connection.client.execute('SELECT * FROM document_revision')).rows).toHaveLength(2);
    expect((await connection.client.execute('SELECT * FROM content_outbox')).rows).toHaveLength(2);
    expect((await connection.client.execute('SELECT * FROM document')).rows).toHaveLength(2);
    await connection.db.run(sql`DROP TRIGGER prevent_delete`);
    expect((await repository.delete(book)).isSuccess).toBe(true);
    expect((await repository.findById("book-1")).getValue()).toBeNull();
    expect((await repository.findById("book-2")).getValue()).not.toBeNull();
    expect((await connection.client.execute('SELECT * FROM document')).rows.map(row => row.id)).toEqual(['doc-2']);
    expect((await connection.client.execute('SELECT * FROM document_revision')).rows.map(row => row.document_id)).toEqual(['doc-2']);
    expect((await connection.client.execute('SELECT * FROM content_outbox')).rows.map(row => row.nanobook_id)).toEqual(['book-2']);
  });

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
