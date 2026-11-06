import { describe, expect, it } from "vitest";
import { financialComponentMounts } from "../../browser/financialComponentMounts";
import { renderMarkdown } from "../../../rendering/shared/renderMarkdown";
import { createFinancialContentExtensions } from "../rendering/createFinancialContentExtensions";
import { financialComponentBlockDefinitions, priceChartProps } from "./priceChart";

describe("price-chart", () => {
  it("applies the default height and rejects empty series", () => {
    const ok = priceChartProps.parse({ series: { type: "line", data: [{ time: "2026-01-02", value: 1 }] } });
    expect(ok.height).toBe(360);
    expect(priceChartProps.safeParse({ series: { type: "line", data: [] } }).success).toBe(false);
  });

  it("renders a mount point through the module extensions", async () => {
    const source = "```price-chart\nseries:\n  type: line\n  data:\n    - { time: 2026-01-02, value: 10.5 }\n```";
    const html = await renderMarkdown(source, createFinancialContentExtensions());

    expect(html).toContain('data-component="price-chart"');
  }, 30_000);

  it("has a client mounter for every definition", () => {
    expect(Object.keys(financialComponentMounts).sort()).toEqual(
      financialComponentBlockDefinitions.map(({ name }) => name).sort(),
    );
  });
});
