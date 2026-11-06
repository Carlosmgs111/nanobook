import { AreaSeries, CandlestickSeries, createChart, LineSeries } from "lightweight-charts";
import { priceChartProps } from "../../shared/components/priceChart";
import type { ComponentMount } from "../../../rendering/browser/componentRegistry";

function themeColor(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export const mountPriceChart: ComponentMount = (element, rawProps) => {
  const props = priceChartProps.parse(rawProps);

  const wrapper = document.createElement("figure");
  wrapper.className = "financial-price-chart";
  if (props.title) {
    const caption = document.createElement("figcaption");
    caption.textContent = props.title;
    wrapper.append(caption);
  }
  const canvas = document.createElement("div");
  canvas.style.height = `${props.height}px`;
  wrapper.append(canvas);
  element.replaceChildren(wrapper);

  const text = themeColor("--theme-content-muted", "#8a8f98");
  const border = themeColor("--theme-border", "#2a2d33");
  const accent = themeColor("--theme-action-primary", "#3fb68b");

  const chart = createChart(canvas, {
    autoSize: true,
    layout: { background: { color: "transparent" }, textColor: text },
    grid: { vertLines: { color: border }, horzLines: { color: border } },
    rightPriceScale: { borderColor: border },
    timeScale: { borderColor: border },
  });

  const { series } = props;
  if (series.type === "candlestick") {
    chart.addSeries(CandlestickSeries).setData(series.data);
  } else if (series.type === "area") {
    chart.addSeries(AreaSeries, { lineColor: accent, topColor: `${accent}55`, bottomColor: `${accent}00` }).setData(series.data);
  } else {
    chart.addSeries(LineSeries, { color: accent }).setData(series.data);
  }
  chart.timeScale().fitContent();

  return () => chart.remove();
};
