import { z } from "zod";
import type { FinancialBlock, FinancialFenceKind, FinancialUnit } from "../model/FinancialBlock";
import type { CurrencyCode, FinancialSource, SourceId } from "../model/FinancialSource";
import type { FinancialBlockParseErrorCode, FinancialBlockPath } from "../parsing/FinancialBlockParseError";

const MAX_SERIES = 8;
const MAX_POINTS = 120;
const MAX_METRICS = 12;
const MAX_NEWS = 12;
const MAX_SOURCES = 30;

const text = z.string().trim().min(1).max(200);
const longText = z.string().trim().min(1).max(2000);
const sourceId = z.string().trim().max(64).regex(/^[a-z0-9-]+$/);
const date = z.string().trim().pipe(z.iso.date());
const url = z.string().trim().max(2048).refine((value) => {
  // URL can silently remove controls or reinterpret backslashes as slashes.
  if (/[\u0000-\u001f\u007f-\u009f\\]/.test(value) || !/^https:\/\/[^/]/i.test(value)) {
    return false;
  }
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}, { params: { code: "invalid-url" } });
const currencyCode = z.string().trim().refine((value) => /^[A-Z]{3}$/.test(value), {
  params: { code: "invalid-currency" },
});
const finiteNumber = z.number().finite();

const period = z.object({
  label: text,
  from: date.optional(),
  to: date.optional(),
}).strict();

const source = z.object({
  id: sourceId,
  label: text,
  organization: text.optional(),
  url,
  type: z.enum(["filing", "earnings", "news", "dataset", "other"]),
  publishedAt: date.optional(),
  period: period.optional(),
  accessedAt: date.optional(),
}).strict().refine((value) => value.publishedAt !== undefined || value.period !== undefined, {
  params: { code: "missing-source-date" },
});

const sourceList = z.array(source).min(1).max(MAX_SOURCES);
const sourceIds = z.array(sourceId).min(1).max(MAX_SOURCES);
const common = {
  version: z.literal(1),
  title: text.optional(),
  description: longText.optional(),
};
const quantity = {
  unit: z.enum(["number", "percent", "currency", "multiple"]),
  currency: currencyCode.optional(),
  precision: z.literal([0, 1, 2, 3, 4]).optional(),
};

function addIssue(
  ctx: z.RefinementCtx,
  code: FinancialBlockParseErrorCode,
  path: FinancialBlockPath,
): void {
  ctx.addIssue({ code: "custom", params: { code }, path: [...path] });
}

function validateCurrency(
  value: { unit: FinancialUnit; currency?: CurrencyCode },
  ctx: z.RefinementCtx,
): void {
  if ((value.unit === "currency") !== (value.currency !== undefined)) {
    addIssue(ctx, "invalid-currency", ["currency"]);
  }
}

function indexSources(
  sources: FinancialSource[],
  field: "sources" | "items",
  ctx: z.RefinementCtx,
): Map<SourceId, FinancialSource> {
  const byId = new Map<SourceId, FinancialSource>();
  sources.forEach((item, index) => {
    if (byId.has(item.id)) {
      addIssue(ctx, "duplicate-source-id", [field, index, "id"]);
    } else {
      byId.set(item.id, item);
    }
  });
  return byId;
}

function validateSourceIds(
  ids: SourceId[],
  sources: Map<SourceId, FinancialSource>,
  path: FinancialBlockPath,
  ctx: z.RefinementCtx,
): void {
  const seen = new Set<SourceId>();
  ids.forEach((id, index) => {
    if (seen.has(id)) {
      addIssue(ctx, "duplicate-source-reference", [...path, index]);
    } else if (!sources.has(id)) {
      addIssue(ctx, "missing-source-reference", [...path, index]);
    }
    seen.add(id);
  });
}

const companyProfile = z.object({
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

const chartSeries = z.object({
  ...quantity,
  name: text,
  values: z.array(finiteNumber.nullable()).max(MAX_POINTS),
  sourceIds,
}).strict().superRefine(validateCurrency);

const financialChart = z.object({
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

const financialMetrics = z.object({
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

const financialNews = z.object({
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

const financialSources = z.object({
  ...common,
  kind: z.literal("financial-sources"),
  items: sourceList,
}).strict().superRefine((block, ctx) => {
  indexSources(block.items, "items", ctx);
});

export const financialBlockSchemas = {
  "company-profile": companyProfile,
  "financial-chart": financialChart,
  "financial-metrics": financialMetrics,
  "financial-news": financialNews,
  "financial-sources": financialSources,
} satisfies { [Kind in FinancialFenceKind]: z.ZodType<Extract<FinancialBlock, { kind: Kind }>> };
