import { z } from "zod";
import type { FinancialUnit } from "../model/FinancialBlock";
import type { CurrencyCode, FinancialSource, SourceId } from "../model/FinancialSource";
import type { FinancialBlockPath, FinancialIssueCode } from "./financialIssueMessages";

export const MAX_SERIES = 8;
export const MAX_POINTS = 120;
export const MAX_METRICS = 12;
export const MAX_NEWS = 12;
const MAX_SOURCES = 30;

export const text = z.string().trim().min(1).max(200);
export const longText = z.string().trim().min(1).max(2000);
export const sourceId = z.string().trim().max(64).regex(/^[a-z0-9-]+$/);
export const date = z.string().trim().pipe(z.iso.date().refine((value) => !value.startsWith("0000-"), {
  params: { code: "invalid-date" },
}));
export const url = z.string().trim().max(2048).refine((value) => {
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
export const currencyCode = z.string().trim().refine((value) => /^[A-Z]{3}$/.test(value), {
  params: { code: "invalid-currency" },
});
export const finiteNumber = z.number().finite();

export const period = z.object({
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

export const sourceList = z.array(source).min(1).max(MAX_SOURCES);
export const sourceIds = z.array(sourceId).min(1).max(MAX_SOURCES);
export const common = {
  version: z.literal(1),
  title: text.optional(),
  description: longText.optional(),
};
export const quantity = {
  unit: z.enum(["number", "percent", "currency", "multiple"]),
  currency: currencyCode.optional(),
  precision: z.literal([0, 1, 2, 3, 4]).optional(),
};

export function addIssue(
  ctx: z.RefinementCtx,
  code: FinancialIssueCode,
  path: FinancialBlockPath,
): void {
  ctx.addIssue({ code: "custom", params: { code }, path: [...path] });
}

export function validateCurrency(
  value: { unit: FinancialUnit; currency?: CurrencyCode },
  ctx: z.RefinementCtx,
): void {
  if ((value.unit === "currency") !== (value.currency !== undefined)) {
    addIssue(ctx, "invalid-currency", ["currency"]);
  }
}

export function indexSources(
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

export function validateSourceIds(
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
