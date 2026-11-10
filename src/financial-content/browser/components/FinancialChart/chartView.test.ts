import { describe, expect, it } from "vitest";
import type { FinancialChartBlock } from "../../../shared/model/FinancialBlock";
import { createChartView, dashPattern, markerPath } from "./chartView";

const source = {
  id: "example",
  label: "Fuente",
  url: "https://example.com/data",
  type: "dataset" as const,
  period: { label: "2024" },
};

function chart(overrides: Partial<FinancialChartBlock> = {}): FinancialChartBlock {
  return {
    kind: "financial-chart",
    version: 1,
    title: "Ingresos",
    chart: "line",
    x: ["2022", "2023", "2024"],
    series: [{ name: "A", unit: "number", values: [1, 2, 3], sourceIds: ["example"] }],
    sources: [source],
    ...overrides,
  };
}

describe("createChartView", () => {
  it("breaks a line at missing points and draws isolated points as markers", () => {
    const view = createChartView(
      chart({ series: [{ name: "A", unit: "number", values: [1, null, 3], sourceIds: ["example"] }] }),
    );

    expect(view.series[0].marks.map((mark) => mark.kind)).toEqual(["marker", "marker"]);
  });

  it("joins consecutive points in a single path", () => {
    const [mark] = createChartView(chart()).series[0].marks;

    expect(mark.kind).toBe("line");
    expect(mark.kind === "line" && mark.d.split(" L ")).toHaveLength(3);
  });

  it("anchors the first, last and inner category labels", () => {
    const { xTicks } = createChartView(chart());

    expect(xTicks.map((tick) => tick.anchor)).toEqual(["start", "middle", "end"]);
  });

  it("centres the only category label", () => {
    const view = createChartView(
      chart({ x: ["2024"], series: [{ name: "A", unit: "number", values: [5], sourceIds: ["example"] }] }),
    );

    expect(view.xTicks.map((tick) => tick.anchor)).toEqual(["middle"]);
  });

  it("shortens long category labels with an ellipsis", () => {
    const long = "Categoría extraordinariamente larga";
    const view = createChartView(
      chart({ x: [long], series: [{ name: "A", unit: "number", values: [5], sourceIds: ["example"] }] }),
    );

    expect(view.xTicks[0].label).toBe(`${Array.from(long).slice(0, 15).join("")}…`);
  });

  it("draws bars, marks zero values as a line and omits missing ones", () => {
    const view = createChartView(
      chart({ chart: "bar", series: [{ name: "A", unit: "number", values: [4, 0, null], sourceIds: ["example"] }] }),
    );

    expect(view.series[0].marks.map((mark) => mark.kind)).toEqual(["bar", "zero"]);
  });

  it("includes zero in the scale of a positive-only bar chart", () => {
    const view = createChartView(
      chart({ chart: "bar", series: [{ name: "A", unit: "number", values: [50, 60, 70], sourceIds: ["example"] }] }),
    );

    expect(view.yTicks.map((tick) => tick.label)).toContain("0,00");
  });

  it("summarises the axes outside the SVG for narrow screens", () => {
    const { axisSummary } = createChartView(chart());

    expect(axisSummary.x).toBe("2022 · 2023 · 2024");
    expect(axisSummary.y).toMatch(/^Mínimo .+ · Máximo .+$/);
  });

  it("describes the chart for assistive technology", () => {
    expect(createChartView(chart()).description).toContain("Gráfico de líneas.");
    expect(createChartView(chart({ chart: "bar" })).description).toContain("Gráfico de barras.");
  });
});

describe("series styling", () => {
  it("leaves the first series solid and gives later ones distinct dash patterns", () => {
    expect(dashPattern(0)).toBeUndefined();
    const patterns = [1, 2, 3, 4, 5, 6, 7].map(dashPattern);

    expect(new Set(patterns).size).toBe(7);
  });

  it("uses a different marker shape for each of the eight series", () => {
    const shapes = Array.from({ length: 8 }, (_, index) => markerPath({ x: 0, y: 0 }, index));

    expect(new Set(shapes).size).toBe(8);
  });
});
