import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { createDatabase } from "../../../../shared/infrastructure/database/createDatabase";
import { DrizzleContentOutboxDispatcher } from "./DrizzleContentOutboxDispatcher";

describe("DrizzleContentOutboxDispatcher", () => {
  let connection: ReturnType<typeof createDatabase>;

  beforeEach(async () => {
    connection = createDatabase({ url: ":memory:" });
    await connection.db.run(sql`CREATE TABLE content_outbox (id TEXT PRIMARY KEY, nanobook_id TEXT NOT NULL, content_version INTEGER NOT NULL, event_type TEXT NOT NULL, payload_json TEXT NOT NULL, created_at INTEGER NOT NULL, delivered_at INTEGER)`);
    await connection.db.run(sql`INSERT INTO content_outbox (id, nanobook_id, content_version, event_type, payload_json, created_at) VALUES ('event-1', 'book-a', 1, 'document.updated', '{"documentId":"doc-1"}', 1)`);
  });

  afterEach(() => connection.client.close());

  it("delivers pending events and marks them atomically after the handler succeeds", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const dispatcher = new DrizzleContentOutboxDispatcher(connection.db, handler);

    expect(await dispatcher.dispatch("book-a")).toBe(1);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "document.updated",
      payload: { documentId: "doc-1" },
    }));
    expect((await connection.client.execute("SELECT delivered_at FROM content_outbox WHERE id = 'event-1'")).rows[0]?.delivered_at).not.toBeNull();
    expect(await dispatcher.dispatch("book-a")).toBe(0);
  });

  it("leaves the event pending when delivery fails", async () => {
    const dispatcher = new DrizzleContentOutboxDispatcher(
      connection.db,
      vi.fn().mockRejectedValue(new Error("temporary")),
    );

    await expect(dispatcher.dispatch("book-a")).rejects.toThrow("temporary");
    expect((await connection.client.execute("SELECT delivered_at FROM content_outbox WHERE id = 'event-1'")).rows[0]?.delivered_at).toBeNull();
  });
});
