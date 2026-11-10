import { z } from "zod";
import {
  MAX_POINTS,
  MAX_SERIES,
  addIssue,
  common,
  finiteNumber,
  indexSources,
  quantity,
  sourceIds,
  sourceList,
  text,
  validateCurrency,
  validateSourceIds,
} from "../../../shared/validation/financialPrimitives";

const chartSeries = z.object({
  ...quantity,
  name: text,
  values: z.array(finiteNumber.nullable()).max(MAX_POINTS),
  sourceIds,
}).strict().superRefine(validateCurrency);

export const financialChartSchema = z.object({
  ...common,
  kind: z.literal("financial-chart"),
  title: text,
  chart: z.enum(["line", "bar"]),
  x: z.array(text).min(1).max(MAX_POINTS),
  series: z.array(chartSeries).min(1).max(MAX_SERIES),
  sources: sourceList,
}).strict().superRefine((block, ctx) => {
  const sources = indexSources(block.sources, "sources", ctx);
  const firstSeries = block.series[0];
  block.series.forEach((series, index) => {
    if (series.values.length !== block.x.length) {
      addIssue(ctx, "series-length", ["series", index, "values"]);
    } else if (!series.values.some((value) => value !== null)) {
      addIssue(ctx, "empty-series", ["series", index, "values"]);
    }
    if (series.unit !== firstSeries.unit) {
      addIssue(ctx, "incompatible-series", ["series", index, "unit"]);
    } else if (series.currency !== firstSeries.currency) {
      addIssue(ctx, "incompatible-series", ["series", index, "currency"]);
    }
    validateSourceIds(series.sourceIds, sources, ["series", index, "sourceIds"], ctx);
  });
});
