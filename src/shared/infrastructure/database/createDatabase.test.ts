import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createDatabase } from "./createDatabase";

const databases: Array<ReturnType<typeof createDatabase>> = [];

afterEach(() => {
  for (const database of databases.splice(0)) {
    database.client.close();
  }
});

describe("createDatabase", () => {
  it("opens an in-memory SQLite database and exposes Drizzle", async () => {
    const database = createDatabase({ url: ":memory:" });
    databases.push(database);

    const result = await database.client.execute("SELECT 1 AS ok");

    expect(result.rows[0]?.ok).toBe(1);
    expect(database.db).toBeDefined();
  });

  it("does not expose credentials through a database description", () => {
    const database = createDatabase({
      url: "file:./data/nanobook.db",
      authToken: "secret-token",
    });
    databases.push(database);

    expect(database).not.toHaveProperty("authToken");
  });

  it("creates the missing directory of a local file database", () => {
    const root = mkdtempSync(join(tmpdir(), "nanobook-db-"));
    const directory = join(root, "nested", "data");
    try {
      const database = createDatabase({ url: `file:${join(directory, "nanobook.db")}` });
      databases.push(database);

      expect(existsSync(directory)).toBe(true);
    } finally {
      for (const database of databases.splice(0)) database.client.close();
      try {
        rmSync(root, { recursive: true, force: true });
      } catch {
        // Windows can keep the SQLite file locked briefly; the temp folder is disposable.
      }
    }
  });
});
