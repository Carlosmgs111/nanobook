import { formatFinancialValue } from "../formatting/formatFinancialValue";
import type { FinancialChartBlock } from "../model/FinancialBlock";
import {
  categoryX,
  CHART_PLOT,
  createBars,
  createChartScale,
  createLineSegments,
  type Point,
} from "./ChartGeometry";

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
const MAX_TICK_LABELS = 5;
const WIDE_LABEL = 11;

type AxisQuantity = Pick<FinancialChartBlock["series"][number], "unit" | "currency" | "precision">;

export type ChartMark =
  | { kind: "bar"; x: number; y: number; width: number; height: number; strokeWidth: number }
  | { kind: "zero"; x1: number; x2: number; y: number }
  | { kind: "line"; d: string }
  | { kind: "marker"; d: string };

export interface ChartView {
  /** Líneas horizontales de la escala, con su etiqueta; `squeeze` indica una etiqueta demasiado larga. */
  yTicks: { y: number; label: string; squeeze: boolean }[];
  xTicks: { x: number; label: string; anchor: "start" | "middle" | "end" }[];
  /** Referencias del eje X y texto del eje Y para la vista estrecha, fuera del SVG. */
  axisSummary: { x: string; y: string };
  /** Texto accesible del SVG. */
  description: string;
  series: { index: number; dash: string | undefined; marks: ChartMark[] }[];
}

/** Trazo de un marcador (punto aislado o muestra de la leyenda) para la serie `index`. */
export function markerPath({ x, y }: Point, index: number): string {
  return `M ${x} ${y} ${MARKERS[index]}`;
}

export function dashPattern(index: number): string | undefined {
  return index === 0 ? undefined : DASH_PATTERNS[index];
}

function formatExponentialTick(value: number, { unit, currency }: AxisQuantity, precision?: number): string {
  const magnitude = value.toExponential(precision).replace(".", ",").replace(/^-/, "−");
  switch (unit) {
    case "currency": return `${currency} ${magnitude}`;
    case "percent": return `${magnitude} %`;
    case "multiple": return `${magnitude}×`;
    case "number": return magnitude;
  }
}

function formatAxisLabels(ticks: number[], { unit, currency, precision }: AxisQuantity): string[] {
  const startingPrecision = precision ?? (unit === "percent" || unit === "multiple" ? 1 : 2);
  let labels: string[] = [];
  let useExponential: boolean[] = [];

  for (const attempt of AXIS_PRECISIONS.slice(startingPrecision)) {
    const format = (value: number) => formatFinancialValue({ value, unit, currency, precision: attempt });
    const zero = format(0);
    labels = ticks.map(format);
    const distinct = new Set(labels).size === ticks.length;
    const roundsToZero = ticks.map((value, index) => value !== 0 && labels[index] === zero);
    useExponential = ticks.map((value, index) =>
      labels[index].length > WIDE_LABEL || (value !== 0 && (!distinct || roundsToZero[index])));
    if (distinct && !roundsToZero.includes(true)) break;
  }

  if (!useExponential.includes(true)) return labels;
  const compactLabels = (precision?: number) => labels.map((label, index) =>
    useExponential[index] ? formatExponentialTick(ticks[index], { unit, currency }, precision) : label);
  for (const attempt of AXIS_PRECISIONS.slice(1)) {
    const compact = compactLabels(attempt);
    if (new Set(compact).size === ticks.length) return compact;
  }
  // Use the shortest round-trip representation when rounded labels still collide.
  return compactLabels();
}

function describe(block: FinancialChartBlock): string {
  return [
    block.description,
    block.chart === "bar"
      ? "Gráfico de barras. En cada categoría, las barras siguen el orden de la leyenda."
      : "Gráfico de líneas.",
    "Los valores y las fuentes están disponibles junto al gráfico.",
  ].filter(Boolean).join(" ");
}

/** Todo lo que el SVG necesita ya calculado: la plantilla solo dibuja. */
export function createChartView(block: FinancialChartBlock): ChartView {
  const values = block.series.flatMap((series) => series.values);
  if (block.chart === "bar") values.push(0);
  const scale = createChartScale(values);

  const categoryCount = block.x.length;
  const tickCount = Math.min(categoryCount, MAX_TICK_LABELS);
  const xIndexes = Array.from({ length: tickCount }, (_, tick) =>
    tickCount === 1 ? 0 : Math.round(tick * (categoryCount - 1) / (tickCount - 1)));
  const yLabels = formatAxisLabels(scale.ticks, block.series[0]);
  const last = categoryCount - 1;

  const series = block.series.map(({ values: seriesValues }, index): ChartView["series"][number] => {
    const marks: ChartMark[] = block.chart === "bar"
      ? createBars(seriesValues, scale, { index, count: block.series.length }).map((bar): ChartMark =>
        bar.isZero
          ? { kind: "zero", x1: bar.x, x2: bar.x + bar.width, y: bar.y }
          : { kind: "bar", x: bar.x, y: bar.y, width: bar.width, height: bar.height, strokeWidth: bar.strokeWidth })
      : createLineSegments(seriesValues, scale).map((segment): ChartMark =>
        segment.length === 1
          ? { kind: "marker", d: markerPath(segment[0], index) }
          : { kind: "line", d: `M ${segment.map(({ x, y }) => `${x} ${y}`).join(" L ")}` });
    return { index, dash: dashPattern(index), marks };
  });

  const [min, max] = yLabels;
  return {
    yTicks: scale.ticks.map((value, index) => ({
      y: scale.y(value),
      label: yLabels[index],
      squeeze: yLabels[index].length > WIDE_LABEL,
    })),
    xTicks: xIndexes.map((index) => {
      const characters = Array.from(block.x[index]);
      return {
        x: categoryX(index, categoryCount, block.chart),
        label: characters.length > 16 ? `${characters.slice(0, 15).join("")}…` : block.x[index],
        anchor: last === 0 ? "middle" : index === 0 ? "start" : index === last ? "end" : "middle",
      };
    }),
    axisSummary: {
      x: xIndexes.map((index) => block.x[index]).join(" · "),
      y: max === undefined ? min : `Mínimo ${min} · Máximo ${max}`,
    },
    description: describe(block),
    series,
  };
}

export { CHART_PLOT };
