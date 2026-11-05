import type { Element } from "hast";
import { formatFinancialValue } from "../formatting/formatFinancialValue";
import type { FinancialChartBlock } from "../model/FinancialBlock";
import {
  categoryX,
  CHART_HEIGHT,
  CHART_PLOT,
  CHART_WIDTH,
  createBars,
  createChartScale,
  createLineSegments,
  type ChartScale,
} from "./chart/ChartGeometry";
import { element, externalLink, financialId, text } from "./hast";
import type { FinancialRenderContext } from "./renderFinancialBlock";

const DASH_PATTERNS = ["", "8 4", "2 4", "10 4 2 4", "4 4", "12 4 4 4", "2 3 2 7", "8 3 4 3 2 3"];

function dashPattern(index: number) {
  return index === 0 ? {} : { strokeDashArray: DASH_PATTERNS[index] };
}

function renderAxes(block: FinancialChartBlock, scale: ChartScale): Element {
  const { left, top, right, bottom } = CHART_PLOT;
  const yTicks = scale.ticks.map((value) => {
    const y = scale.y(value);
    const label = formatFinancialValue({ ...block.series[0], value });
    // Compact large values in the plot margin. The table uses the full format.
    const tickLabel = label.length > 11 ? value.toExponential(1).replace(".", ",") : label;
    return element("g", [
      element("line", [], { x1: left, x2: right, y1: y, y2: y, stroke: "currentColor", opacity: 0.25 }),
      element("text", [text(tickLabel)], { x: left - 8, y: y + 4, textAnchor: "end" }),
    ]);
  });

  const last = block.x.length - 1;
  const count = Math.min(block.x.length, 5);
  const xTicks = Array.from({ length: count }, (_, tick) => {
    const index = count === 1 ? 0 : Math.round(tick * last / (count - 1));
    const x = categoryX(index, block.x.length, block.chart);
    const label = Array.from(block.x[index]);
    const tickLabel = label.length > 16 ? `${label.slice(0, 15).join("")}…` : block.x[index];
    const anchor = last === 0 ? "middle" : index === 0 ? "start" : index === last ? "end" : "middle";
    return element("g", [
      element("line", [], { x1: x, x2: x, y1: bottom, y2: bottom + 5, stroke: "currentColor" }),
      element("text", [text(tickLabel)], { x, y: bottom + 22, textAnchor: anchor }),
    ]);
  });

  return element("g", [
    element("line", [], { x1: left, x2: left, y1: top, y2: bottom, stroke: "currentColor" }),
    element("line", [], { x1: left, x2: right, y1: bottom, y2: bottom, stroke: "currentColor" }),
    ...yTicks,
    ...xTicks,
  ], { className: ["financial-chart__axes"], fill: "currentColor", fontSize: 11 });
}

function renderSeries(block: FinancialChartBlock, scale: ChartScale): Element[] {
  return block.series.map(({ values }, index) => {
    const marks = block.chart === "bar"
      ? createBars(values, scale, { index, count: block.series.length }).map((bar) => element("rect", [], {
        ...bar, fill: "currentColor", fillOpacity: 0.25, ...dashPattern(index),
      }))
      : createLineSegments(values, scale).map((segment) => {
        const points = segment.map(({ x, y }) => `${x} ${y}`);
        const d = points.length === 1 ? `M ${points[0]} h 0` : `M ${points.join(" L ")}`;
        return element("path", [], {
          d, fill: "none", strokeLinecap: "round",
          ...(points.length === 1 ? { strokeWidth: 5 } : { strokeWidth: 2, ...dashPattern(index) }),
        });
      });
    return element("g", marks, {
      className: ["financial-chart__series"],
      dataSeries: index,
      stroke: "currentColor",
    });
  });
}

function renderLegend(block: FinancialChartBlock): Element {
  const sources = new Map(block.sources.map((source) => [source.id, source]));
  const items = block.series.map((series, index) => {
    const sourcesForSeries = series.sourceIds.flatMap((id) => {
      const source = sources.get(id);
      return source ? [externalLink(source.label, source.url)] : [];
    });
    const citations = sourcesForSeries.flatMap((link, position) => position === 0 ? [link] : [text(", "), link]);
    const sample = block.chart === "bar"
      ? element("rect", [], { x: 3, y: 2, width: 26, height: 8, fill: "currentColor", fillOpacity: 0.25 })
      : element("line", [], { x1: 2, x2: 30, y1: 6, y2: 6, strokeWidth: 2 });

    return element("li", [
      element("svg", [sample], {
        className: ["financial-chart__key"], viewBox: "0 0 32 12", width: 32, height: 12,
        ariaHidden: "true", stroke: "currentColor", ...dashPattern(index),
      }),
      text(` ${series.name} · Fuentes `),
      ...citations,
    ], { dataSeries: index });
  });
  return element("ol", items, { className: ["financial-chart__legend"] });
}

function renderTable(block: FinancialChartBlock, headingId: string): Element {
  const header = element("tr", [
    element("th", [text("Categoría")], { scope: "col" }),
    ...block.series.map(({ name }) => element("th", [text(name)], { scope: "col" })),
  ]);
  const rows = block.x.map((label, index) => element("tr", [
    element("th", [text(label)], { scope: "row" }),
    ...block.series.map((series) => {
      const value = series.values[index];
      return element("td", [text(value === null ? "Sin dato" : formatFinancialValue({ ...series, value }))]);
    }),
  ]));
  return element("details", [
    element("summary", [text("Ver datos del gráfico")]),
    element("table", [element("thead", [header]), element("tbody", rows)], { ariaLabelledBy: headingId }),
  ], { className: ["financial-chart__data"] });
}

export function renderFinancialChart(block: FinancialChartBlock, context: FinancialRenderContext): Element {
  const headingId = financialId("chart", context.blockIndex, "heading");
  const titleId = financialId("chart", context.blockIndex, "title");
  const descriptionId = financialId("chart", context.blockIndex, "description");
  const values = block.series.flatMap((series) => series.values);
  if (block.chart === "bar") values.push(0);
  const scale = createChartScale(values);
  const description = [
    block.description,
    block.chart === "bar"
      ? "Gráfico de barras. En cada categoría, las barras siguen el orden de la leyenda."
      : "Gráfico de líneas.",
    "Los valores y las fuentes están disponibles junto al gráfico.",
  ].filter(Boolean).join(" ");

  return element("figure", [
    element("figcaption", [
      element("h2", [text(block.title)], { id: headingId }),
      ...(block.description ? [element("p", [text(block.description)])] : []),
    ]),
    element("svg", [
      element("title", [text(block.title)], { id: titleId }),
      element("desc", [text(description)], { id: descriptionId }),
      renderAxes(block, scale),
      ...renderSeries(block, scale),
    ], {
      className: ["financial-chart__plot"],
      viewBox: `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`,
      role: "img",
      ariaLabelledBy: `${titleId} ${descriptionId}`,
    }),
    renderLegend(block),
    renderTable(block, headingId),
  ], { className: ["financial-block", "financial-chart"] });
}
