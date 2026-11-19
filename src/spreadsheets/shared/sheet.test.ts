import { describe, expect, it } from "vitest";
import { columnLabel, columnTotal, compareCells, parseCellInput, sheetWidth } from "./sheet";

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

describe("columnLabel", () => {
  it("numbers columns like a spreadsheet", () => {
    expect([0, 1, 25, 26, 27, 51, 52, 701, 702].map(columnLabel)).toEqual(["A", "B", "Z", "AA", "AB", "AZ", "BA", "ZZ", "AAA"]);
  });
});

describe("compareCells", () => {
  it("sorts numbers first, then text, then empty cells", () => {
    const cells = ["b", null, 10, "a", 2, ""];

    expect([...cells].sort(compareCells)).toEqual([2, 10, "a", "b", null, ""]);
  });
});

describe("parseCellInput", () => {
  it("turns empty or blank text into an empty cell", () => {
    expect(parseCellInput("")).toBeNull();
    expect(parseCellInput("  ")).toBeNull();
  });

  it("converts only plain decimal numbers", () => {
    expect(parseCellInput("12.5")).toBe(12.5);
    expect(parseCellInput("-3")).toBe(-3);
    expect(parseCellInput("0")).toBe(0);
    expect(parseCellInput(" 42 ")).toBe(42);
  });

  it("keeps anything else as typed", () => {
    expect(parseCellInput("007")).toBe("007");
    expect(parseCellInput("0x1F")).toBe("0x1F");
    expect(parseCellInput("1e3")).toBe("1e3");
    expect(parseCellInput("1.")).toBe("1.");
    expect(parseCellInput("abc")).toBe("abc");
  });
});
