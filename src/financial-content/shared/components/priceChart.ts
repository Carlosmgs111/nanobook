import { z } from "zod";
import type { ComponentBlockDefinition } from "../../../rendering/shared/componentBlocks/ComponentBlockDefinition";

const time = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usa fechas YYYY-MM-DD");

const lineSeries = z.object({
  type: z.enum(["line", "area"]),
  data: z.array(z.object({ time, value: z.number().finite() })).min(1).max(5000),
});

const candlestickSeries = z.object({
  type: z.literal("candlestick"),
  data: z
    .array(
      z.object({
        time,
        open: z.number().finite(),
        high: z.number().finite(),
        low: z.number().finite(),
        close: z.number().finite(),
      }),
    )
    .min(1)
    .max(5000),
});

export const priceChartProps = z.object({
  title: z.string().max(120).optional(),
  height: z.number().int().min(160).max(800).default(360),
  series: z.discriminatedUnion("type", [lineSeries, candlestickSeries]),
});

export type PriceChartProps = z.infer<typeof priceChartProps>;

export const priceChartDefinition: ComponentBlockDefinition = {
  name: "price-chart",
  props: priceChartProps,
};

/** Componentes interactivos del módulo; cada uno requiere un montador en `browser/`. */
export const financialComponentBlockDefinitions: readonly ComponentBlockDefinition[] = [priceChartDefinition];
