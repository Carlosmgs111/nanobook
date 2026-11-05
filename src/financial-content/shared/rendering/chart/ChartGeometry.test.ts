import { describe, expect, it } from "vitest";
import { createBars, createChartScale, createLineSegments } from "./ChartGeometry";

describe("chart geometry", () => {
  it("maps positive and negative values into the plot area", () => {
    const scale = createChartScale([-5, null, 15]);

    expect(scale.y(-5)).toBe(304);
    expect(scale.y(0)).toBe(234);
    expect(scale.y(15)).toBe(24);
  });

  it.each([
    { value: 0, lower: -1, upper: 1 },
    { value: 20, lower: 19, upper: 21 },
    { value: -20, lower: -21, upper: -19 },
  ])("expands the constant domain $value symmetrically", ({ value, lower, upper }) => {
    const scale = createChartScale([value, null, value]);

    expect(scale.y(lower)).toBe(304);
    expect(scale.y(value)).toBe(164);
    expect(scale.y(upper)).toBe(24);
  });

  it("keeps finite coordinates for the full range of finite numbers", () => {
    const max = Number.MAX_VALUE;
    const scale = createChartScale([-max, max]);

    expect(scale.y(-max)).toBe(304);
    expect(scale.y(0)).toBe(164);
    expect(scale.y(max)).toBe(24);
    expect(createChartScale([max]).y(max)).toBe(164);
    expect(createChartScale([Number.MIN_VALUE]).y(Number.MIN_VALUE)).toBe(164);
  });

  it("splits line segments at null values and keeps isolated points", () => {
    const values = [null, -10, 0, null, 10];

    expect(createLineSegments(values, createChartScale(values))).toEqual([
      [{ x: 248, y: 304 }, { x: 424, y: 164 }],
      [{ x: 776, y: 24 }],
    ]);
  });

  it("omits null bars without shifting category positions", () => {
    const values = [-10, null, 10, 0];

    expect(createBars(values, createChartScale(values))).toEqual([
      { x: 94, y: 164, width: 132, height: 140 },
      { x: 446, y: 24, width: 132, height: 140 },
      { x: 622, y: 164, width: 132, height: 0 },
    ]);
  });

  it("gives each bar series a stable slot in each category", () => {
    const scale = createChartScale([0, 2, 8]);
    const first = createBars([null, 8], scale, { index: 0, count: 2 });
    const second = createBars([2, 2], scale, { index: 1, count: 2 });

    expect(first).toEqual([{ x: 468, y: 24, width: 132, height: 280 }]);
    expect(second).toEqual([
      { x: 248, y: 234, width: 132, height: 70 },
      { x: 600, y: 234, width: 132, height: 70 },
    ]);
  });
});
