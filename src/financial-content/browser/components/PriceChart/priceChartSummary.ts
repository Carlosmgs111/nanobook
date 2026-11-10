import type { PriceChartProps } from "./PriceChart.schema";

function describe(kind: string, data: readonly { time: string }[], latest: string): string {
  const count = data.length;
  const range =
    count === 1 ? `1 observación el ${data[0].time}` : `${count} observaciones entre ${data[0].time} y ${data[count - 1].time}`;
  return `${kind}: ${range}; ${latest}.`;
}

/**
 * Resumen en texto de una serie de precios, para dar contenido al gráfico antes
 * de que cargue su JavaScript y a quien no lo ve. Los números se escriben sin
 * formato regional para que servidor y navegador produzcan el mismo texto.
 */
export function describePriceChart({ series }: PriceChartProps): string {
  if (series.type === "candlestick") {
    const last = series.data[series.data.length - 1];
    return describe("Gráfico de velas", series.data, `último cierre ${last.close}`);
  }
  const last = series.data[series.data.length - 1];
  return describe(series.type === "area" ? "Serie de área" : "Serie de línea", series.data, `último valor ${last.value}`);
}
