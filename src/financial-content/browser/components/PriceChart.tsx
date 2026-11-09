import { useEffect, useRef } from "react";
import type { PriceChartProps } from "../../shared/components/priceChart";
import { describePriceChart } from "../../shared/components/priceChartSummary";

/**
 * Bloque `price-chart`, una isla de React: el servidor entrega la figura con su título, el hueco
 * del alto exacto (sin saltos de maquetación) y un resumen en texto; el gráfico
 * se dibuja en el navegador tras hidratar, porque `lightweight-charts` necesita
 * el DOM. El contenedor del gráfico no tiene hijos de React, así que la librería
 * puede poblarlo sin que React lo vea.
 */
export default function PriceChart(props: PriceChartProps) {
  const canvas = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let dispose: (() => void) | undefined;

    // Importación diferida: la librería no se evalúa en el servidor ni antes de hidratar.
    void import("./createPriceChart").then(({ createPriceChart }) => {
      if (disposed || !canvas.current) return;
      dispose = createPriceChart(canvas.current, props);
    });

    return () => {
      disposed = true;
      dispose?.();
    };
  }, [props]);

  return (
    <figure className="financial-price-chart">
      {props.title && <figcaption>{props.title}</figcaption>}
      <div ref={canvas} style={{ height: `${props.height}px` }} />
      <p className="financial-price-chart-summary">{describePriceChart(props)}</p>
    </figure>
  );
}
