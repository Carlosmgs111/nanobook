import { AreaSeries, CandlestickSeries, createChart, LineSeries } from "lightweight-charts";
import type { PriceChartProps } from "../../shared/components/priceChart";

function themeColor(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/**
 * Dibuja el gráfico de precios dentro de `container` (que debe tener ya su alto)
 * y devuelve la función que lo destruye. No crea ni sustituye ningún otro nodo:
 * lo comparten el montador vanilla de `price-chart` y la isla `price-chart-island`.
 */
export function createPriceChart(container: HTMLElement, props: PriceChartProps): () => void {
  const text = themeColor("--theme-content-muted", "#8a8f98");
  const border = themeColor("--theme-border", "#2a2d33");
  const accent = themeColor("--theme-action-primary", "#3fb68b");

  const chart = createChart(container, {
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
}
