import type { Element, Text } from "hast";
import { formatFinancialDate } from "../formatting/formatFinancialDate";
import { formatFinancialValue } from "../formatting/formatFinancialValue";
import type { FinancialChartBlock } from "../model/FinancialBlock";
import type { FinancialSource, ISODate } from "../model/FinancialSource";
import {
  categoryX,
  CHART_HEIGHT,
  CHART_PLOT,
  CHART_WIDTH,
  createBars,
  createChartScale,
  createLineSegments,
  type ChartScale,
  type Point,
} from "./chart/ChartGeometry";
import { element, externalLink, financialId, text } from "./hast";
import type { FinancialRenderContext } from "./renderFinancialBlock";

const DASH_PATTERNS = ["", "8 4", "2 4", "10 4 2 4", "4 4", "12 4 4 4", "2 3 2 7", "8 3 4 3 2 3"];
const MARKERS = [
  "m -3 0 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0 z",
  "m -3 -3 h 6 v 6 h -6 z",
  "m 0 -4 l 4 4 -4 4 -4 -4 z",
  "m 0 -4 l 4 7 h -8 z",
  "m 0 4 l -4 -7 h 8 z",
  "m -4 0 h 8 m -4 -4 v 8",
  "m -3 -3 l 6 6 m 0 -6 l -6 6",
  "m -2 -3 h 4 l 2 3 -2 3 h -4 l -2 -3 z",
];
const AXIS_PRECISIONS = [0, 1, 2, 3, 4] as const;

type AxisQuantity = Pick<FinancialChartBlock["series"][number], "unit" | "currency" | "precision">;

function dashPattern(index: number) {
  return index === 0 ? {} : { strokeDashArray: DASH_PATTERNS[index] };
}

function renderMarker({ x, y }: Point, index: number): Element {
  return element("path", [], {
    className: ["financial-chart__marker"],
    d: `M ${x} ${y} ${MARKERS[index]}`,
    fill: "none",
    strokeWidth: 1.5,
  });
}

function formatExponentialTick(value: number, { unit, currency }: AxisQuantity, precision?: number): string {
  const magnitude = value.toExponential(precision).replace(".", ",").replace(/^-/, "−");
  switch (unit) {
    case "currency": return `${currency}\u00a0${magnitude}`;
    case "percent": return `${magnitude}\u00a0%`;
    case "multiple": return `${magnitude}×`;
    case "number": return magnitude;
  }
}

function formatAxisLabels(ticks: number[], { unit, currency, precision }: AxisQuantity): string[] {
  const startingPrecision = precision ?? (unit === "percent" || unit === "multiple" ? 1 : 2);
  let labels: string[] = [];
  let useExponential: boolean[] = [];

  for (const precision of AXIS_PRECISIONS.slice(startingPrecision)) {
    const format = (value: number) => formatFinancialValue({ value, unit, currency, precision });
    const zero = format(0);
    labels = ticks.map(format);
    const distinct = new Set(labels).size === ticks.length;
    const roundsToZero = ticks.map((value, index) => value !== 0 && labels[index] === zero);
    useExponential = ticks.map((value, index) =>
      labels[index].length > 11 || (value !== 0 && (!distinct || roundsToZero[index])));
    if (distinct && !roundsToZero.includes(true)) break;
  }

  if (!useExponential.includes(true)) return labels;
  const compactLabels = (precision?: number) => labels.map((label, index) =>
    useExponential[index] ? formatExponentialTick(ticks[index], { unit, currency }, precision) : label);
  for (const precision of AXIS_PRECISIONS.slice(1)) {
    const compact = compactLabels(precision);
    if (new Set(compact).size === ticks.length) return compact;
  }
  // Use the shortest round-trip representation when rounded labels still collide.
  return compactLabels();
}

function renderAxes(block: FinancialChartBlock, scale: ChartScale, xTicks: number[], yLabels: string[]): Element {
  const { left, top, right, bottom } = CHART_PLOT;
  const yTicks = scale.ticks.map((value, index) => {
    const y = scale.y(value);
    const label = yLabels[index];
    return element("g", [
      element("line", [], { x1: left, x2: right, y1: y, y2: y, stroke: "currentColor", opacity: 0.25 }),
      element("text", [text(label)], {
        x: left - 8, y: y + 4, textAnchor: "end",
        ...(label.length > 11 ? { textLength: left - 10, lengthAdjust: "spacingAndGlyphs" } : {}),
      }),
    ]);
  });

  const last = block.x.length - 1;
  const categories = xTicks.map((index) => {
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
    ...categories,
  ], { className: ["financial-chart__axes"], fill: "currentColor", fontSize: 11 });
}

function renderAxisSummary(xLabels: string[], yLabels: string[]): Element {
  const [min, max] = yLabels;
  return element("dl", [
    element("dt", [text("Referencias del eje X")]),
    element("dd", [text(xLabels.join(" · "))]),
    element("dt", [text("Eje Y")]),
    element("dd", [text(max === undefined ? min : `Mínimo ${min} · Máximo ${max}`)]),
  ], { className: ["financial-chart__axis-summary"] });
}

function renderSeries(block: FinancialChartBlock, scale: ChartScale): Element[] {
  return block.series.map(({ values }, index) => {
    const marks = block.chart === "bar"
      ? createBars(values, scale, { index, count: block.series.length }).map(({ isZero, ...bar }) => {
        if (isZero) {
          return element("line", [], {
            className: ["financial-chart__zero"],
            x1: bar.x, x2: bar.x + bar.width, y1: bar.y, y2: bar.y,
            strokeWidth: 3, strokeLinecap: "butt",
          });
        }
        return element("rect", [], { ...bar, fill: "currentColor", fillOpacity: 0.25, ...dashPattern(index) });
      })
      : createLineSegments(values, scale).map((segment) => {
        if (segment.length === 1) return renderMarker(segment[0], index);
        const d = `M ${segment.map(({ x, y }) => `${x} ${y}`).join(" L ")}`;
        return element("path", [], {
          className: ["financial-chart__line"], d, fill: "none",
          strokeWidth: 2, strokeLinecap: "round", ...dashPattern(index),
        });
      });
    return element("g", marks, {
      className: ["financial-chart__series"],
      dataSeries: index,
      stroke: "currentColor",
    });
  });
}

function renderCitation(source: FinancialSource): Element {
  const children: Array<Element | Text> = [externalLink(source.label, source.url)];
  function appendDate(label: string, date: ISODate | undefined): void {
    if (date) children.push(text(label), element("time", [text(formatFinancialDate(date))], { dateTime: date }));
  }
  if (source.period) {
    children.push(text(` · Periodo ${source.period.label}`));
    appendDate(" desde ", source.period.from);
    appendDate(" hasta ", source.period.to);
  }
  appendDate(" · Publicado ", source.publishedAt);
  appendDate(" · Consultado ", source.accessedAt);
  return element("span", children);
}

function renderLegend(block: FinancialChartBlock): Element {
  const sources = new Map(block.sources.map((source) => [source.id, source]));
  const items = block.series.map((series, index) => {
    const sourcesForSeries = series.sourceIds.flatMap((id) => {
      const source = sources.get(id);
      return source ? [renderCitation(source)] : [];
    });
    const citations = sourcesForSeries.flatMap((link, position) => position === 0 ? [link] : [text(", "), link]);
    const sample = block.chart === "bar"
      ? [element("rect", [], { x: 3, y: 2, width: 26, height: 8, fill: "currentColor", fillOpacity: 0.25, ...dashPattern(index) })]
      : [
        element("line", [], { x1: 2, x2: 30, y1: 6, y2: 6, strokeWidth: 2, ...dashPattern(index) }),
        renderMarker({ x: 16, y: 6 }, index),
      ];

    return element("li", [
      element("svg", sample, {
        className: ["financial-chart__key"], viewBox: "0 0 32 12", width: 32, height: 12,
        ariaHidden: "true", stroke: "currentColor",
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
    element("div", [
      element("table", [element("thead", [header]), element("tbody", rows)], { ariaLabelledBy: headingId }),
    ], {
      className: ["financial-chart__table"],
      tabIndex: 0,
      role: "region",
      ariaLabel: "Datos del gráfico",
    }),
  ], { className: ["financial-chart__data"] });
}

export function renderFinancialChart(block: FinancialChartBlock, context: FinancialRenderContext): Element {
  const headingId = financialId("chart", context.blockIndex, "heading");
  const titleId = financialId("chart", context.blockIndex, "title");
  const descriptionId = financialId("chart", context.blockIndex, "description");
  const values = block.series.flatMap((series) => series.values);
  if (block.chart === "bar") values.push(0);
  const scale = createChartScale(values);
  const categoryCount = block.x.length;
  const tickCount = Math.min(categoryCount, 5);
  const xTicks = Array.from({ length: tickCount }, (_, tick) =>
    tickCount === 1 ? 0 : Math.round(tick * (categoryCount - 1) / (tickCount - 1)));
  const yLabels = formatAxisLabels(scale.ticks, block.series[0]);
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
      renderAxes(block, scale, xTicks, yLabels),
      ...renderSeries(block, scale),
    ], {
      className: ["financial-chart__plot"],
      viewBox: `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`,
      role: "img",
      ariaLabelledBy: `${titleId} ${descriptionId}`,
    }),
    renderAxisSummary(xTicks.map((index) => block.x[index]), yLabels),
    renderLegend(block),
    renderTable(block, headingId),
  ], { className: ["financial-block", "financial-chart"] });
}
