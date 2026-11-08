import { describe, expect, it } from "vitest";
import { priceChartProps } from "./priceChart";
import { describePriceChart } from "./priceChartSummary";

const parse = (series: unknown) => priceChartProps.parse({ series });

describe("describePriceChart", () => {
  it("describes a candlestick series with its last close", () => {
    const props = parse({
      type: "candlestick",
      data: [
        { time: "2026-01-02", open: 10, high: 12, low: 9, close: 11 },
        { time: "2026-01-05", open: 11, high: 13, low: 10, close: 12.5 },
        { time: "2026-01-06", open: 12.5, high: 14, low: 12, close: 13 },
      ],
    });

    expect(describePriceChart(props)).toBe(
      "Gráfico de velas: 3 observaciones entre 2026-01-02 y 2026-01-06; último cierre 13.",
    );
  });

  it("describes a line series with its last value", () => {
    const props = parse({
      type: "line",
      data: [
        { time: "2026-01-02", value: 10 },
        { time: "2026-01-03", value: 12.25 },
      ],
    });

    expect(describePriceChart(props)).toBe(
      "Serie de línea: 2 observaciones entre 2026-01-02 y 2026-01-03; último valor 12.25.",
    );
  });

  it("describes an area series", () => {
    const props = parse({
      type: "area",
      data: [
        { time: "2026-01-02", value: 1 },
        { time: "2026-01-03", value: 2 },
      ],
    });

    expect(describePriceChart(props)).toMatch(/^Serie de área: 2 observaciones/);
  });

  it("uses the singular for a single observation", () => {
    const props = parse({ type: "line", data: [{ time: "2026-01-02", value: 10 }] });

    expect(describePriceChart(props)).toBe("Serie de línea: 1 observación el 2026-01-02; último valor 10.");
  });

  it("does not depend on the locale, so server and browser agree", () => {
    const props = parse({ type: "line", data: [{ time: "2026-01-02", value: 1234567.5 }] });

    expect(describePriceChart(props)).toContain("1234567.5");
  });
});
