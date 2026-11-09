import { describe, expect, it } from "vitest";
import { priceChartProps } from "./priceChart";

describe("price-chart props", () => {
  it("applies the default height and rejects empty series", () => {
    const ok = priceChartProps.parse({ series: { type: "line", data: [{ time: "2026-01-02", value: 1 }] } });
    expect(ok.height).toBe(360);
    expect(priceChartProps.safeParse({ series: { type: "line", data: [] } }).success).toBe(false);
  });
});
