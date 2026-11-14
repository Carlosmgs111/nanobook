import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createBlockRegistry } from "../../rendering/shared";
import { SpreadsheetsModule } from "./index";
import { spreadsheetProps } from "./components/Spreadsheet/Spreadsheet.schema";
import { spreadsheetTotalsProps } from "./components/SpreadsheetTotals/SpreadsheetTotals.schema";

describe("SpreadsheetsModule", () => {
  it("registers its blocks only when it is composed, pointing to components that exist", () => {
    const blocks = createBlockRegistry();
    expect(blocks.find("spreadsheet")).toBeUndefined();

    SpreadsheetsModule.create(blocks);

    expect(blocks.blocks.map(({ name }) => name).sort()).toEqual(["spreadsheet", "spreadsheet-totals"]);
    for (const { name, component } of blocks.blocks) expect(existsSync(`.${component}`), name).toBe(true);
  });

  it("does not clash with another module's block names", () => {
    const blocks = createBlockRegistry();
    SpreadsheetsModule.create(blocks);

    expect(() => SpreadsheetsModule.create(blocks)).toThrow(/duplicado/i);
  });
});

describe("spreadsheet schemas", () => {
  it("defaults a sheet to read-only and totals to a sum", () => {
    expect(spreadsheetProps.parse({ rows: [[1]] }).readOnly).toBe(true);
    expect(spreadsheetTotalsProps.parse({ columns: ["a"], rows: [[1]] }).functions).toEqual(["sum"]);
  });

  it("rejects unknown fields, empty sheets and unknown functions", () => {
    expect(spreadsheetProps.safeParse({ rows: [[1]], extra: true }).success).toBe(false);
    expect(spreadsheetProps.safeParse({ rows: [] }).success).toBe(false);
    expect(spreadsheetTotalsProps.safeParse({ columns: ["a"], rows: [[1]], functions: ["median"] }).success).toBe(false);
  });
});
