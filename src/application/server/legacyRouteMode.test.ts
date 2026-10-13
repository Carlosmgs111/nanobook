import { describe, expect, it } from "vitest";
import { shouldUseNanobookSqlCutover } from "./legacyRouteMode";

describe("shouldUseNanobookSqlCutover", () => {
  it("requires an explicit true flag", () => {
    expect(shouldUseNanobookSqlCutover({ NANOBOOK_SQL_CUTOVER: "true" })).toBe(true);
    expect(shouldUseNanobookSqlCutover({ NANOBOOK_SQL_CUTOVER: "false" })).toBe(false);
    expect(shouldUseNanobookSqlCutover({})).toBe(false);
  });
});
