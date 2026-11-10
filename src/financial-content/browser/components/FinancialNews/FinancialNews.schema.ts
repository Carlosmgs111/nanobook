import { z } from "zod";
import {
  MAX_NEWS,
  addIssue,
  common,
  indexSources,
  longText,
  sourceId,
  sourceList,
  text,
} from "../../../shared/validation/financialPrimitives";

export const financialNewsSchema = z.object({
  ...common,
  kind: z.literal("financial-news"),
  items: z.array(z.object({
    title: text,
    summary: longText,
    sourceId,
    relatedTickers: z.array(text).optional(),
    mentionedMetrics: z.array(text).optional(),
  }).strict()).min(1).max(MAX_NEWS),
  sources: sourceList,
}).strict().superRefine((block, ctx) => {
  const sources = indexSources(block.sources, "sources", ctx);
  block.items.forEach((item, index) => {
    const reference = sources.get(item.sourceId);
    const path = ["items", index, "sourceId"];
    if (!reference) {
      addIssue(ctx, "missing-source-reference", path);
    } else if (reference.type !== "news") {
      addIssue(ctx, "invalid-source-type", path);
    }
  });
});
