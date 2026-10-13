import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

import { createDatabase } from "../../../../shared/infrastructure/database/createDatabase";
import { Document } from "../../domain/Document";
import type { DocumentMetadata } from "../../domain/types";
import { DrizzleContentRepository } from "./DrizzleContentRepository";
import { DocumentRevisionConflictError } from "../../domain/errors";

const metadata = (id: string, ownerId: string): DocumentMetadata => ({
  id,
  title: id,
  description: "Description",
  author: "Author",
  ownerId,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  tags: ["docs"],
});

describe("DrizzleContentRepository", () => {
  let connection: ReturnType<typeof createDatabase>;
  let first: DrizzleContentRepository;
  let second: DrizzleContentRepository;

  beforeEach(async () => {
    connection = createDatabase({ url: ":memory:" });
    await connection.db.run(sql`PRAGMA foreign_keys = ON`);
    await connection.db.run(sql`CREATE TABLE user (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, email_verified INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0)`);
    await connection.db.run(sql`CREATE TABLE nanobook (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, visibility TEXT NOT NULL DEFAULT 'private', settings_json TEXT NOT NULL DEFAULT '{}', content_version INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`);
    await connection.db.run(sql`CREATE TABLE document (id TEXT PRIMARY KEY, nanobook_id TEXT NOT NULL REFERENCES nanobook(id) ON DELETE RESTRICT, path TEXT NOT NULL, public_path TEXT NOT NULL, parent_path TEXT, title TEXT NOT NULL, description TEXT NOT NULL, body TEXT NOT NULL, metadata_json TEXT NOT NULL, raw_frontmatter TEXT NOT NULL, owner_id TEXT REFERENCES user(id) ON DELETE RESTRICT, revision INTEGER NOT NULL DEFAULT 1, content_hash TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER)`);
    await connection.db.run(sql`CREATE UNIQUE INDEX document_live_path_unique ON document (nanobook_id, path)`);
    await connection.db.run(sql`CREATE UNIQUE INDEX document_live_public_path_unique ON document (nanobook_id, public_path)`);
    await connection.db.run(sql`CREATE TABLE document_revision (document_id TEXT NOT NULL REFERENCES document(id) ON DELETE RESTRICT, revision INTEGER NOT NULL, snapshot_json TEXT NOT NULL, actor_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT, operation TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (document_id, revision))`);
    await connection.db.run(sql`CREATE TABLE content_outbox (id TEXT PRIMARY KEY NOT NULL, nanobook_id TEXT NOT NULL REFERENCES nanobook(id) ON DELETE RESTRICT, content_version INTEGER NOT NULL, event_type TEXT NOT NULL, payload_json TEXT NOT NULL, created_at INTEGER NOT NULL, delivered_at INTEGER)`);
    await connection.db.run(sql`INSERT INTO user (id, name, email) VALUES ('owner-1', 'Owner', 'owner@example.com')`);
    await connection.db.run(sql`INSERT INTO user (id, name, email) VALUES ('owner-2', 'Owner 2', 'owner2@example.com')`);
    await connection.db.run(sql`INSERT INTO nanobook (id, owner_id, slug, name, created_at, updated_at) VALUES ('book-a', 'owner-1', 'a', 'A', 0, 0)`);
    await connection.db.run(sql`INSERT INTO nanobook (id, owner_id, slug, name, created_at, updated_at) VALUES ('book-b', 'owner-2', 'b', 'B', 0, 0)`);
    first = new DrizzleContentRepository(connection.db, "book-a");
    second = new DrizzleContentRepository(connection.db, "book-b");
  });

  afterEach(() => connection.client.close());

  it("keeps identical paths isolated between nanobooks", async () => {
    const document = Document.create("guide/index", metadata("doc-a", "owner-1"), "# A").getValue();
    const other = Document.create("guide/index", metadata("doc-b", "owner-2"), "# B").getValue();

    expect((await first.create(document)).isSuccess).toBe(true);
    expect((await second.create(other)).isSuccess).toBe(true);
    expect((await first.getByPublicPath("guide")).getValue()?.getContent()).toBe("# A");
    expect((await second.getByPublicPath("guide")).getValue()?.getContent()).toBe("# B");
    expect((await first.getById("doc-b")).getValue()).toBeNull();
    expect((await connection.client.execute("SELECT COUNT(*) AS count FROM document_revision")).rows[0]?.count).toBe(2);
  });

  it("lists direct children without loading another nanobook", async () => {
    const root = Document.create("index", metadata("root", "owner-1"), "root").getValue();
    const child = Document.create("guide", metadata("child", "owner-1"), "child").getValue();
    const nested = Document.create("guide/details", metadata("nested", "owner-1"), "nested").getValue();
    await first.create(root);
    await first.create(child);
    await first.create(nested);
    await second.create(Document.create("guide", metadata("other", "owner-2"), "other").getValue());

    const children = await first.listChildren("index");
    expect(children.getValue().map((value) => value.getDocumentId().getValue())).toEqual(["child"]);
  });

  it("updates only when the expected revision is current", async () => {
    const original = Document.create("guide/revisioned", metadata("revisioned", "owner-1"), "# A").getValue();
    await first.create(original);

    const changed = Document.create(
      "guide/revisioned",
      { ...metadata("revisioned", "owner-1"), updatedAt: new Date("2026-01-02T00:00:00.000Z") },
      "# B",
      undefined,
      undefined,
      "revisioned",
    ).getValue();
    const update = await first.updateWithRevision?.(changed, 1);
    expect(update?.isSuccess).toBe(true);

    const stale = Document.create(
      "guide/revisioned",
      { ...metadata("revisioned", "owner-1"), updatedAt: new Date("2026-01-03T00:00:00.000Z") },
      "# C",
      undefined,
      undefined,
      "revisioned",
    ).getValue();
    const conflict = await first.updateWithRevision?.(stale, 1);
    expect(conflict?.isSuccess).toBe(false);
    expect(conflict?.getError()).toBeInstanceOf(DocumentRevisionConflictError);
    expect((await first.getById("revisioned")).getValue()?.getContent()).toBe("# B");
    expect((await connection.client.execute("SELECT revision, operation FROM document_revision WHERE document_id = 'revisioned' ORDER BY revision")).rows).toEqual([
      { revision: 1, operation: "create" },
      { revision: 2, operation: "update" },
    ]);
  });

  it("deletes a SQL subtree in one transaction", async () => {
    const root = Document.create("guide/index", metadata("delete-root", "owner-1"), "# Guide").getValue();
    const child = Document.create("guide/intro", metadata("delete-child", "owner-1"), "# Intro").getValue();
    await first.create(root);
    await first.create(child);

    const result = await first.deleteMany?.([root, child]);

    expect(result?.isSuccess).toBe(true);
    expect((await first.list()).getValue()).toHaveLength(0);
    expect((await connection.client.execute("SELECT operation FROM document_revision WHERE operation = 'delete' ORDER BY document_id")).rows).toHaveLength(2);
  });

  it("moves a SQL subtree in one transaction", async () => {
    const root = Document.create("guide/index", metadata("move-root", "owner-1"), "# Guide").getValue();
    const child = Document.create("guide/intro", metadata("move-child", "owner-1"), "# Intro").getValue();
    await first.create(root);
    await first.create(child);
    const movedRoot = root.moveTo("reference/index").getValue();
    const movedChild = child.moveTo("reference/intro").getValue();

    const result = await first.updateMany?.([
      { document: movedRoot, previousPath: "guide/index" },
      { document: movedChild, previousPath: "guide/intro" },
    ]);

    expect(result?.isSuccess).toBe(true);
    expect((await first.getByPath("reference/index")).getValue()?.getDocumentId().getValue()).toBe("move-root");
    expect((await first.getByPath("reference/intro")).getValue()?.getDocumentId().getValue()).toBe("move-child");
  });
});
