import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";

import { createDatabase } from "../../../../shared/infrastructure/database/createDatabase";
import { Document } from "../../domain/Document";
import { DocumentAlreadyExistsError, DocumentRevisionConflictError } from "../../domain/errors";
import { DrizzleContentRepository } from "./DrizzleContentRepository";

const make = (path: string, id: string, title = id) =>
  Document.create(path, {
    id,
    title,
    description: "d",
    author: "A",
    ownerId: "owner-1",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  }, "# body").getValue();

describe("DrizzleContentRepository write paths", () => {
  let connection: ReturnType<typeof createDatabase>;
  let repository: DrizzleContentRepository;

  beforeEach(async () => {
    connection = createDatabase({ url: ":memory:" });
    const { db } = connection;
    await db.run(sql`PRAGMA foreign_keys = ON`);
    await migrate(db, { migrationsFolder: "./drizzle" });
    await db.run(sql`INSERT INTO user (id, name, email) VALUES ('owner-1', 'Owner', 'owner@example.com')`);
    await db.run(sql`INSERT INTO nanobook (id, owner_id, slug, name, created_at, updated_at) VALUES ('book-a', 'owner-1', 'a', 'A', 0, 0)`);
    await db.run(sql`INSERT INTO nanobook (id, owner_id, slug, name, created_at, updated_at) VALUES ('book-b', 'owner-1', 'b', 'B', 0, 0)`);
    repository = new DrizzleContentRepository(db);
  });

  afterEach(() => connection.client.close());

  it("creates documents per nanobook and refuses a duplicate path inside one", async () => {
    expect((await repository.create("book-a", make("guide/index", "a1"))).isSuccess).toBe(true);
    expect((await repository.create("book-b", make("guide/index", "b1"))).isSuccess).toBe(true);

    const duplicate = await repository.create("book-a", make("guide/index", "a2"));

    expect(duplicate.getError()).toBeInstanceOf(DocumentAlreadyExistsError);
    expect((await repository.getById("book-a", "a1")).getValue()?.getRevision()).toBe(1);
    expect((await repository.getById("book-a", "b1")).getValue()).toBeNull();
  });

  it("updates only at the expected revision and within the nanobook", async () => {
    await repository.create("book-a", make("intro", "a1"));
    const edited = make("intro", "a1", "New");

    expect((await repository.updateMany("book-a", [{ document: edited }])).isSuccess).toBe(true);
    const stored = (await repository.getById("book-a", "a1")).getValue()!;
    expect([stored.getTitle(), stored.getRevision()]).toEqual(["New", 2]);

    expect((await repository.updateMany("book-a", [{ document: edited, expectedRevision: 1 }])).getError())
      .toBeInstanceOf(DocumentRevisionConflictError);
    expect((await repository.updateMany("book-b", [{ document: edited, expectedRevision: 2 }])).getError())
      .toBeInstanceOf(DocumentRevisionConflictError);
  });

  it("applies a subtree move atomically", async () => {
    const root = make("guide/index", "root");
    const child = make("guide/intro", "child");
    await repository.create("book-a", root);
    await repository.create("book-a", child);

    const moved = await repository.updateMany("book-a", [
      { document: root.moveTo("ref/index").getValue() },
      { document: child.moveTo("ref/intro").getValue() },
    ]);
    expect(moved.isSuccess).toBe(true);
    expect((await repository.getByPath("book-a", "ref/intro")).getValue()?.getDocumentId().getValue()).toBe("child");

    const failed = await repository.updateMany("book-a", [
      { document: child.moveTo("again/intro").getValue(), expectedRevision: 2 },
      { document: root, expectedRevision: 1 },
    ]);
    expect(failed.isSuccess).toBe(false);
    expect((await repository.getById("book-a", "child")).getValue()?.getPath()).toBe("ref/intro");
  });

  it("soft deletes within the nanobook, frees the path and rejects stale revisions", async () => {
    const root = make("guide/index", "root");
    const child = make("guide/intro", "child");
    await repository.create("book-a", root);
    await repository.create("book-a", child);

    expect((await repository.deleteMany("book-b", [root])).getError()).toBeInstanceOf(DocumentRevisionConflictError);
    expect((await repository.list("book-a")).getValue()).toHaveLength(2);

    expect((await repository.deleteMany("book-a", [root, child])).isSuccess).toBe(true);
    expect((await repository.list("book-a")).getValue()).toHaveLength(0);
    expect((await repository.create("book-a", make("guide/index", "again"))).isSuccess).toBe(true);
    expect((await repository.deleteMany("book-a", [root])).getError()).toBeInstanceOf(DocumentRevisionConflictError);
  });
});
