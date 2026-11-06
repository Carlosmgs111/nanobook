export const CHART_WIDTH = 800;
export const CHART_HEIGHT = 360;
const MARGIN = { left: 72, top: 24, right: 24, bottom: 56 };
export const CHART_PLOT = {
  left: MARGIN.left,
  top: MARGIN.top,
  right: CHART_WIDTH - MARGIN.right,
  bottom: CHART_HEIGHT - MARGIN.bottom,
};
const PLOT_WIDTH = CHART_PLOT.right - CHART_PLOT.left;
const PLOT_HEIGHT = CHART_PLOT.bottom - CHART_PLOT.top;

export interface ChartScale {
  ticks: number[];
  y(value: number): number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Bar extends Point {
  width: number;
  height: number;
  strokeWidth: number;
  isZero: boolean;
}

export function createChartScale(values: readonly (number | null)[]): ChartScale {
  const numbers = values.filter((value) => value !== null);
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const range = max - min;

  function fraction(value: number): number {
    if (range === 0) {
      if (min === 0) return 0.5 + value / 2;
      // Divide before applying the 10% span so tiny domains stay nonzero.
      return 0.5 + (value - min) / Math.abs(min) / 0.1;
    }
    if (!Number.isFinite(range)) {
      return (value / 2 - min / 2) / (max / 2 - min / 2);
    }
    return (value - min) / range;
  }

  return {
    ticks: min === max ? [min] : [min, max],
    y(value) {
      const position = Math.max(0, Math.min(1, fraction(value)));
      return CHART_PLOT.bottom - position * PLOT_HEIGHT;
    },
  };
}

export function categoryX(index: number, count: number, chart: "line" | "bar"): number {
  if (chart === "bar") return CHART_PLOT.left + (index + 0.5) * (PLOT_WIDTH / count);
  if (count === 1) return CHART_PLOT.left + PLOT_WIDTH / 2;
  return CHART_PLOT.left + index * PLOT_WIDTH / (count - 1);
}

export function createLineSegments(values: readonly (number | null)[], scale: ChartScale): Point[][] {
  const segments: Point[][] = [];
  let segment: Point[] | undefined;
  values.forEach((value, index) => {
    if (value === null) {
      segment = undefined;
      return;
    }
    if (!segment) {
      segment = [];
      segments.push(segment);
    }
    segment.push({ x: categoryX(index, values.length, "line"), y: scale.y(value) });
  });
  return segments;
}

export function createBars(
  values: readonly (number | null)[],
  scale: ChartScale,
  group = { index: 0, count: 1 },
): Bar[] {
  const groupWidth = 0.75 * (PLOT_WIDTH / values.length);
  const slotWidth = groupWidth / group.count;
  const gap = Math.min(2, slotWidth / 4);
  const width = slotWidth - gap;
  const baseline = scale.y(0);
  const bars: Bar[] = [];
  values.forEach((value, index) => {
    if (value === null) return;
    const y = scale.y(value);
    bars.push({
      x: categoryX(index, values.length, "bar") - groupWidth / 2 + group.index * slotWidth + gap / 2,
      y: Math.min(y, baseline),
      width,
      height: Math.abs(y - baseline),
      // Adjacent strokes consume half the gap, leaving space between their edges.
      strokeWidth: gap / 2,
      isZero: value === 0,
    });
  });
  return bars;
}
