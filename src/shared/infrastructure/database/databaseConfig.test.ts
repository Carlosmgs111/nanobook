import { describe, expect, it } from "vitest";

import { getDatabaseOptions } from "./databaseConfig";

describe("database deployment configuration", () => {
  it("keeps the local SQLite default outside Vercel", () => {
    expect(getDatabaseOptions({})).toEqual({ url: "file:./data/nanobook.db", authToken: undefined });
  });

  it("requires a remote libSQL database on Vercel", () => {
    expect(() => getDatabaseOptions({ VERCEL: "1" })).toThrow(/remote libSQL/);
    expect(() => getDatabaseOptions({ VERCEL: "1", DATABASE_URL: "file:./data/nanobook.db" })).toThrow(/remote libSQL/);
    expect(getDatabaseOptions({ VERCEL: "1", DATABASE_URL: "libsql://example.turso.io", DATABASE_AUTH_TOKEN: "token" }))
      .toEqual({ url: "libsql://example.turso.io", authToken: "token" });
  });
});
