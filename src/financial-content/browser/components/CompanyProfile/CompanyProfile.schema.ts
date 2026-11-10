import { z } from "zod";
import {
  common,
  currencyCode,
  date,
  indexSources,
  longText,
  sourceIds,
  sourceList,
  text,
  url,
  validateSourceIds,
} from "../../../shared/validation/financialPrimitives";

export const companyProfileSchema = z.object({
  ...common,
  kind: z.literal("company-profile"),
  sources: sourceList,
  company: z.object({
    name: text,
    ticker: text,
    exchange: text,
    country: text,
    industry: text,
    description: longText,
    reportingCurrency: currencyCode,
    asOf: date,
    links: z.array(z.object({ label: text, url }).strict()).optional(),
    sourceIds,
  }).strict(),
}).strict().superRefine((block, ctx) => {
  const sources = indexSources(block.sources, "sources", ctx);
  validateSourceIds(block.company.sourceIds, sources, ["company", "sourceIds"], ctx);
});
