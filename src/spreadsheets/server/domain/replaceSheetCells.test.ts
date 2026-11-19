import { describe, expect, it } from "vitest";
import { InvalidSheetError, SheetNotFoundError } from "./errors";
import { replaceSheetCells } from "./replaceSheetCells";

const sample = `# Ventas

\`\`\`spreadsheet
# datos oficiales
columns: [Región, Enero]
rows:
  - [Norte, 120] # la mayor
  - [Sur, 98]
\`\`\`

Texto final.
`;
const rows = [["Norte", 120], ["Sur", 98]];
const edited = [["Norte", 120], ["Sur", 105]];

describe("replaceSheetCells", () => {
  it("changes only the edited cell and keeps comments and style", () => {
    const result = replaceSheetCells(sample, rows, edited);

    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toContain("- [Sur, 105]");
    expect(result.getValue().replace("[Sur, 105]", "[Sur, 98]")).toBe(sample);
  });

  it("accepts rows padded with nulls, as the island sends them", () => {
    const result = replaceSheetCells(sample, [["Norte", 120, null], ["Sur", 98, null]], [["Norte", 120, null], ["Sur", 105, null]]);

    expect(result.getValue()).toContain("- [Sur, 105]");
  });

  it("extends a short row up to an edited cell", () => {
    const source = "```spreadsheet\nrows:\n  - [Norte, 120]\n  - [Sur]\n```\n";

    const result = replaceSheetCells(source, [["Norte", 120], ["Sur"]], [["Norte", 120], ["Sur", null, 5]]);

    expect(result.getValue()).toContain("- [Sur, null, 5]");
  });

  it("fails when no sheet matches the original rows", () => {
    const result = replaceSheetCells(sample, [["Norte", 1]], edited);

    expect(result.isSuccess).toBe(false);
    expect(result.getError()).toBeInstanceOf(SheetNotFoundError);
  });

  it("edits the matching sheet and leaves the others untouched", () => {
    const other = "```spreadsheet\nrows:\n  - [a, 1]\n```\n";
    const source = `${other}\n${sample}`;

    const result = replaceSheetCells(source, rows, edited).getValue();

    expect(result.startsWith(other)).toBe(true);
    expect(result).toContain("- [Sur, 105]");
  });

  it("edits the first of two identical sheets", () => {
    const source = `${sample}\n${sample}`;

    const result = replaceSheetCells(source, rows, edited).getValue();

    expect(result.indexOf("[Sur, 105]")).toBeLessThan(result.lastIndexOf("[Sur, 98]"));
    expect(result.split("[Sur, 105]")).toHaveLength(2);
  });

  it("ignores spreadsheet fences nested in other blocks", () => {
    const nested = "- item\n\n    ```spreadsheet\n    rows:\n      - [a]\n    ```\n";

    const result = replaceSheetCells(nested, [["a"]], [["b"]]);

    expect(result.getError()).toBeInstanceOf(SheetNotFoundError);
  });

  it("rejects an edit that makes the sheet invalid", () => {
    const result = replaceSheetCells(sample, rows, [["Norte", 120], ["Sur", "x".repeat(501)]]);

    expect(result.getError()).toBeInstanceOf(InvalidSheetError);
  });

  it("rejects adding or removing rows", () => {
    const result = replaceSheetCells(sample, rows, [["Norte", 120]]);

    expect(result.getError()).toBeInstanceOf(InvalidSheetError);
  });

  it("does not throw when a row is a YAML alias", () => {
    const source = "```spreadsheet\nrows:\n  - &r [a, 1]\n  - *r\n```\n";

    const result = replaceSheetCells(source, [["a", 1], ["a", 1]], [["a", 1], ["a", 2]]);

    expect(result.getError()).toBeInstanceOf(InvalidSheetError);
  });

  it("returns the markdown untouched when nothing changed", () => {
    const source = "```spreadsheet\nrows:\n  - [ a ,1 ]\n```\n";

    const result = replaceSheetCells(source, [["a", 1]], [["a", 1, null]]);

    expect(result.getValue()).toBe(source);
  });

  it("keeps CRLF line endings", () => {
    const crlf = sample.replaceAll("\n", "\r\n");

    const result = replaceSheetCells(crlf, rows, edited).getValue();

    expect(result).toContain("[Sur, 105]");
    expect(/(?<!\r)\n/.test(result)).toBe(false);
  });
});
