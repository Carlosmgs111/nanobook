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
});
