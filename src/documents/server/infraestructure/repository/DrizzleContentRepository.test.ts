import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { readFileSync } from "node:fs";

import { createDatabase } from "../../../../shared/infrastructure/database/createDatabase";
import { Document } from "../../domain/Document";
import type { DocumentMetadata } from "../../domain/types";
import { DrizzleContentRepository } from "./DrizzleContentRepository";

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
    await connection.db.run(sql`CREATE TABLE nanobook (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, visibility TEXT NOT NULL DEFAULT 'private', settings_json TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`);
    await connection.db.run(sql`CREATE TABLE document (id TEXT PRIMARY KEY, nanobook_id TEXT NOT NULL REFERENCES nanobook(id) ON DELETE RESTRICT, path TEXT NOT NULL, public_path TEXT NOT NULL, parent_path TEXT, title TEXT NOT NULL, description TEXT NOT NULL, body TEXT NOT NULL, metadata_json TEXT NOT NULL, raw_frontmatter TEXT NOT NULL, owner_id TEXT REFERENCES user(id) ON DELETE RESTRICT, revision INTEGER NOT NULL DEFAULT 1, content_hash TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER)`);
    await connection.db.run(sql`CREATE UNIQUE INDEX document_live_path_unique ON document (nanobook_id, path)`);
    await connection.db.run(sql`CREATE UNIQUE INDEX document_live_public_path_unique ON document (nanobook_id, public_path)`);
    const migration = readFileSync("drizzle/0007_live_document_paths.sql", "utf8");
    for (const statement of migration.split("--> statement-breakpoint")) {
      await connection.client.execute(statement.trim());
    }
    await connection.db.run(sql`INSERT INTO user (id, name, email) VALUES ('owner-1', 'Owner', 'owner@example.com')`);
    await connection.db.run(sql`INSERT INTO user (id, name, email) VALUES ('owner-2', 'Owner 2', 'owner2@example.com')`);
    await connection.db.run(sql`INSERT INTO nanobook (id, owner_id, slug, name, created_at, updated_at) VALUES ('book-a', 'owner-1', 'a', 'A', 0, 0)`);
    await connection.db.run(sql`INSERT INTO nanobook (id, owner_id, slug, name, created_at, updated_at) VALUES ('book-b', 'owner-2', 'b', 'B', 0, 0)`);
    first = new DrizzleContentRepository(connection.db);
    second = new DrizzleContentRepository(connection.db);
  });

  afterEach(() => connection.client.close());

  it("keeps identical paths isolated between nanobooks", async () => {
    const document = Document.create("guide/index", metadata("doc-a", "owner-1"), "# A").getValue();
    const other = Document.create("guide/index", metadata("doc-b", "owner-2"), "# B").getValue();

    expect((await first.create("book-a", document)).isSuccess).toBe(true);
    expect((await second.create("book-b", other)).isSuccess).toBe(true);
    expect((await first.getByPublicPath("book-a", "guide")).getValue()?.getContent()).toBe("# A");
    expect((await second.getByPublicPath("book-b", "guide")).getValue()?.getContent()).toBe("# B");
    expect((await first.getById("book-a", "doc-b")).getValue()).toBeNull();
  });

  it("persists a document without mutating nanobook metadata", async () => {
    const value = Document.create(
      "guide/index",
      metadata("history-only", "owner-1"),
      "# Guide",
    ).getValue();

    expect((await first.create("book-a", value)).isSuccess).toBe(true);

    const book = (await connection.client.execute(
      "SELECT updated_at FROM nanobook WHERE id = 'book-a'",
    )).rows[0];
    expect(book?.updated_at).toBe(0);
  });

  it("does not persist the historical nanobook marker in SQL metadata", async () => {
    const marked = Document.create(
      "index",
      { ...metadata("legacy-marker", "owner-1"), nanobook: true },
      "# Root",
    ).getValue();

    expect((await first.create("book-a", marked)).isSuccess).toBe(true);
    const row = (await connection.client.execute(
      "SELECT metadata_json FROM document WHERE id = 'legacy-marker'",
    )).rows[0];
    expect(JSON.parse(String(row?.metadata_json))).not.toHaveProperty("nanobook");
  });

  it("lists direct children without loading another nanobook", async () => {
    const root = Document.create("index", metadata("root", "owner-1"), "root").getValue();
    const child = Document.create("guide", metadata("child", "owner-1"), "child").getValue();
    const nested = Document.create("guide/details", metadata("nested", "owner-1"), "nested").getValue();
    await first.create("book-a", root);
    await first.create("book-a", child);
    await first.create("book-a", nested);
    await second.create("book-b", Document.create("guide", metadata("other", "owner-2"), "other").getValue());

    const children = await first.listChildren("book-a", "index");
    expect(children.getValue().map((value) => value.getDocumentId().getValue())).toEqual(["child"]);
  });

  it("deletes a SQL subtree in one transaction", async () => {
    const root = Document.create("guide/index", metadata("delete-root", "owner-1"), "# Guide").getValue();
    const child = Document.create("guide/intro", metadata("delete-child", "owner-1"), "# Intro").getValue();
    await first.create("book-a", root);
    await first.create("book-a", child);

    const result = await first.deleteMany("book-a", [root, child]);

    expect(result.isSuccess).toBe(true);
    expect((await first.list("book-a")).getValue()).toHaveLength(0);
  });

  it("moves a SQL subtree in one transaction", async () => {
    const root = Document.create("guide/index", metadata("move-root", "owner-1"), "# Guide").getValue();
    const child = Document.create("guide/intro", metadata("move-child", "owner-1"), "# Intro").getValue();
    await first.create("book-a", root);
    await first.create("book-a", child);
    const movedRoot = root.moveTo("reference/index").getValue();
    const movedChild = child.moveTo("reference/intro").getValue();

    const result = await first.updateMany("book-a", [
      { document: movedRoot },
      { document: movedChild },
    ]);

    expect(result.isSuccess).toBe(true);
    expect((await first.getByPath("book-a", "reference/index")).getValue()?.getDocumentId().getValue()).toBe("move-root");
    expect((await first.getByPath("book-a", "reference/intro")).getValue()?.getDocumentId().getValue()).toBe("move-child");
  });

});
