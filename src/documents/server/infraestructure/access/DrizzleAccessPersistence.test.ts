import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { readFileSync } from "node:fs";

import { createDatabase } from "../../../../shared/infrastructure/database/createDatabase";
import { DEFAULT_ACCESS_GRANT_POLICY } from "../../domain/access/AccessGrantPolicy";
import { DrizzleDocumentAccessRepository } from "./DrizzleDocumentAccessRepository";
import { DrizzleUnlockAttemptLimiter } from "./DrizzleUnlockAttemptLimiter";

describe("document access persistence", () => {
  let connection: ReturnType<typeof createDatabase>;
  let repository: DrizzleDocumentAccessRepository;
  let limiter: DrizzleUnlockAttemptLimiter;
  const at = new Date("2026-11-04T12:00:00.000Z");

  beforeEach(async () => {
    connection = createDatabase({ url: ":memory:" });
    await connection.db.run(sql`PRAGMA foreign_keys = ON`);
    await connection.db.run(sql`CREATE TABLE document (id TEXT PRIMARY KEY)`);
    const migration = readFileSync("drizzle/0016_document_access.sql", "utf8");
    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.trim()) await connection.client.execute(statement.trim());
    }
    await connection.db.run(sql`INSERT INTO document (id) VALUES ('doc-1'), ('doc-2')`);
    repository = new DrizzleDocumentAccessRepository(connection.db);
    limiter = new DrizzleUnlockAttemptLimiter(connection.db, DEFAULT_ACCESS_GRANT_POLICY);
  });

  afterEach(() => connection.client.close());

  describe("DrizzleDocumentAccessRepository", () => {
    it("returns null when the document has no access record", async () => {
      expect((await repository.get("doc-1")).getValue()).toBeNull();
    });

    it("creates the record at version 1 and bumps it on every change", async () => {
      const first = (await repository.setPasswordHash("doc-1", "hash-a", at)).getValue();
      const second = (await repository.setPasswordHash("doc-1", "hash-b", at)).getValue();
      const cleared = (await repository.setPasswordHash("doc-1", null, at)).getValue();

      expect(first).toEqual({ documentId: "doc-1", passwordHash: "hash-a", passwordVersion: 1 });
      expect(second.passwordVersion).toBe(2);
      expect(second.passwordHash).toBe("hash-b");
      expect(cleared).toEqual({ documentId: "doc-1", passwordHash: null, passwordVersion: 3 });
    });

    it("keeps documents isolated and cascades with the document", async () => {
      await repository.setPasswordHash("doc-1", "hash-a", at);

      expect((await repository.get("doc-2")).getValue()).toBeNull();

      await connection.db.run(sql`DELETE FROM document WHERE id = 'doc-1'`);
      expect((await repository.get("doc-1")).getValue()).toBeNull();
    });
  });

  describe("DrizzleUnlockAttemptLimiter", () => {
    it("blocks after the configured number of failures", async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        expect((await limiter.check("doc-1", "client-a", at)).getValue().blocked).toBe(false);
        await limiter.recordFailure("doc-1", "client-a", at);
      }

      const status = (await limiter.check("doc-1", "client-a", at)).getValue();

      expect(status.blocked).toBe(true);
      expect(status.retryAfterSeconds).toBeGreaterThan(0);
      expect(status.retryAfterSeconds).toBeLessThanOrEqual(900);
    });

    it("isolates clients and documents", async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await limiter.recordFailure("doc-1", "client-a", at);
      }

      expect((await limiter.check("doc-1", "client-b", at)).getValue().blocked).toBe(false);
      expect((await limiter.check("doc-2", "client-a", at)).getValue().blocked).toBe(false);
    });

    it("starts a new window once the previous one expired", async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await limiter.recordFailure("doc-1", "client-a", at);
      }
      const later = new Date(at.getTime() + 901 * 1000);

      expect((await limiter.check("doc-1", "client-a", later)).getValue().blocked).toBe(false);
      await limiter.recordFailure("doc-1", "client-a", later);
      expect((await limiter.check("doc-1", "client-a", later)).getValue().blocked).toBe(false);
    });

    it("clears the counter after a successful unlock", async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await limiter.recordFailure("doc-1", "client-a", at);
      }

      await limiter.reset("doc-1", "client-a");

      expect((await limiter.check("doc-1", "client-a", at)).getValue().blocked).toBe(false);
    });
  });
});
