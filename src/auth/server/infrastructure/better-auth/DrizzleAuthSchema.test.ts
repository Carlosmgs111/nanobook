import { getTableColumns, getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as schema from "./DrizzleAuthSchema";

describe("DrizzleAuthSchema", () => {
  it("declares the JWKS table required by the JWT plugin", () => {
    expect(getTableName(schema.jwks)).toBe("jwks");
    expect(Object.keys(getTableColumns(schema.jwks))).toEqual([
      "id",
      "publicKey",
      "privateKey",
      "alg",
      "crv",
      "createdAt",
      "expiresAt",
    ]);
  });
});
