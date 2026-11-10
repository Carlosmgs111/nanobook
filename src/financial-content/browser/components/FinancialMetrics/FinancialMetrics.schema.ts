import { z } from "zod";
import {
  MAX_METRICS,
  common,
  finiteNumber,
  indexSources,
  longText,
  period,
  quantity,
  sourceIds,
  sourceList,
  text,
  validateCurrency,
  validateSourceIds,
} from "../../../shared/validation/financialPrimitives";

const metric = z.object({
  ...quantity,
  label: text,
  value: finiteNumber,
  period,
  description: longText.optional(),
  comparison: z.object({
    label: text,
    value: finiteNumber,
    direction: z.enum(["favorable", "unfavorable", "neutral"]),
  }).strict().optional(),
  sourceIds,
}).strict().superRefine(validateCurrency);

export const financialMetricsSchema = z.object({
  ...common,
  kind: z.literal("financial-metrics"),
  metrics: z.array(metric).min(1).max(MAX_METRICS),
  sources: sourceList,
}).strict().superRefine((block, ctx) => {
  const sources = indexSources(block.sources, "sources", ctx);
  block.metrics.forEach((item, index) => {
    validateSourceIds(item.sourceIds, sources, ["metrics", index, "sourceIds"], ctx);
  });
});
