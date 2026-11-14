import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import SpreadsheetTotals from "./SpreadsheetTotals.astro";
import { spreadsheetTotalsProps } from "./SpreadsheetTotals.schema";

const props = spreadsheetTotalsProps.parse({
  title: "Resumen",
  columns: ["Región", "Enero"],
  rows: [["Norte", 10], ["Sur", 30.5], ["Este", null]],
  functions: ["sum", "average", "count"],
});

describe("SpreadsheetTotals", () => {
  it("renders one row per function with the column results computed on the server", async () => {
    const html = await (await AstroContainer.create()).renderToString(SpreadsheetTotals, { props });

    expect(html).toContain("Resumen");
    expect(html).toMatch(/Suma<\/th>\s*<td>—<\/td>\s*<td>40,5<\/td>/);
    expect(html).toMatch(/Promedio<\/th>\s*<td>—<\/td>\s*<td>20,25<\/td>/);
    expect(html).toMatch(/Cuenta<\/th>\s*<td>0<\/td>\s*<td>2<\/td>/);
  });

  it("escapes author text", async () => {
    const hostile = spreadsheetTotalsProps.parse({ columns: ["<script>alert(1)</script>"], rows: [[1]] });
    const html = await (await AstroContainer.create()).renderToString(SpreadsheetTotals, { props: hostile });

    expect(html).not.toContain("<script>");
  });
});
