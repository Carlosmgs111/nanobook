import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { priceChartProps } from "../../shared/components/priceChart";
import PriceChart from "./PriceChart";

const props = (extra: object = {}) =>
  priceChartProps.parse({
    height: 240,
    series: {
      type: "line",
      data: [
        { time: "2026-01-02", value: 10 },
        { time: "2026-01-03", value: 12 },
      ],
    },
    ...extra,
  });

describe("PriceChart (server render)", () => {
  it("renders the figure, the title and a fixed-height container without touching the DOM", () => {
    const html = renderToString(createElement(PriceChart, props({ title: "ACME" })));

    expect(html).toContain('<figure class="financial-price-chart">');
    expect(html).toContain("<figcaption>ACME</figcaption>");
    expect(html).toContain("height:240px");
  });

  it("renders a text summary so the chart has content before and without JavaScript", () => {
    const html = renderToString(createElement(PriceChart, props()));

    expect(html).toContain("Serie de línea: 2 observaciones entre 2026-01-02 y 2026-01-03; último valor 12.");
  });

  it("omits the caption when there is no title", () => {
    const html = renderToString(createElement(PriceChart, props()));

    expect(html).not.toContain("<figcaption");
  });
});
