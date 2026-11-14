import { describe, expect, it } from "vitest";
import { columnTotal, sheetWidth } from "./sheet";

const rows = [
  ["Norte", 10, null],
  ["Sur", 30, "n/d"],
  ["Este", 20, null],
];

describe("columnTotal", () => {
  it("computes each function over the numbers of a column", () => {
    expect(columnTotal(rows, 1, "sum")).toBe(60);
    expect(columnTotal(rows, 1, "average")).toBe(20);
    expect(columnTotal(rows, 1, "min")).toBe(10);
    expect(columnTotal(rows, 1, "max")).toBe(30);
    expect(columnTotal(rows, 1, "count")).toBe(3);
  });

  it("ignores text and empty cells", () => {
    expect(columnTotal(rows, 0, "sum")).toBeUndefined();
    expect(columnTotal(rows, 0, "count")).toBe(0);
    expect(columnTotal(rows, 2, "max")).toBeUndefined();
  });
});

describe("sheetWidth", () => {
  it("uses the widest row or the number of labels", () => {
    expect(sheetWidth([["a"], ["a", "b", "c"]])).toBe(3);
    expect(sheetWidth([["a"]], ["x", "y"])).toBe(2);
  });
});
