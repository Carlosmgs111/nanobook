import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";

import { createDatabase } from "../../../../shared/infrastructure/database/createDatabase";
import { DrizzleDocumentUnitOfWork } from "./DrizzleDocumentUnitOfWork";

describe("DrizzleDocumentUnitOfWork", () => {
  let connection: ReturnType<typeof createDatabase>;
  let unitOfWork: DrizzleDocumentUnitOfWork;

  beforeEach(async () => {
    connection = createDatabase({ url: ":memory:" });
    await connection.db.run(sql`CREATE TABLE nanobook (id TEXT PRIMARY KEY, content_version INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0)`);
    await connection.db.run(sql`CREATE TABLE document (id TEXT PRIMARY KEY, nanobook_id TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`);
    await connection.db.run(sql`CREATE TABLE document_revision (document_id TEXT NOT NULL, revision INTEGER NOT NULL, snapshot_json TEXT NOT NULL, actor_id TEXT NOT NULL, operation TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (document_id, revision))`);
    await connection.db.run(sql`CREATE TABLE content_outbox (id TEXT PRIMARY KEY, nanobook_id TEXT NOT NULL, content_version INTEGER NOT NULL, event_type TEXT NOT NULL, payload_json TEXT NOT NULL, created_at INTEGER NOT NULL, delivered_at INTEGER)`);
    await connection.db.run(sql`INSERT INTO nanobook (id) VALUES ('book-1')`);
    unitOfWork = new DrizzleDocumentUnitOfWork(connection.db, "book-1");
  });

  afterEach(() => connection.client.close());

  it("commits revisions, outbox events and the collection version together", async () => {
    await unitOfWork.run(async ({ appendRevision, enqueueEvent, incrementContentVersion }) => {
      await appendRevision({ documentId: "doc-1", revision: 1, snapshot: { body: "a" }, actorId: "user-1", operation: "create" });
      await enqueueEvent("document.created", { documentId: "doc-1" });
      await incrementContentVersion();
    });

    expect((await connection.client.execute("SELECT COUNT(*) AS count FROM document_revision")).rows[0]?.count).toBe(1);
    expect((await connection.client.execute("SELECT COUNT(*) AS count FROM content_outbox")).rows[0]?.count).toBe(1);
    expect((await connection.client.execute("SELECT content_version FROM nanobook")).rows[0]?.content_version).toBe(1);
  });

  it("rolls back all changes when the callback fails", async () => {
    await expect(unitOfWork.run(async ({ appendRevision }) => {
      await appendRevision({ documentId: "doc-1", revision: 1, snapshot: {}, actorId: "user-1", operation: "create" });
      throw new Error("abort");
    })).rejects.toThrow("abort");

    expect((await connection.client.execute("SELECT COUNT(*) AS count FROM document_revision")).rows[0]?.count).toBe(0);
  });
});
