import type {
  CurrencyCode,
  FinancialPeriod,
  FinancialSource,
  HttpsUrl,
  ISODate,
  SourceId,
} from "./FinancialSource";

export type FinancialFenceKind =
  | "company-profile"
  | "financial-chart"
  | "financial-metrics"
  | "financial-news"
  | "financial-sources";

export type FinancialUnit = "number" | "percent" | "currency" | "multiple";

interface FinancialBlockBase {
  kind: string;
  version: 1;
  title?: string;
  description?: string;
}

interface CitedFinancialBlock extends FinancialBlockBase {
  sources: FinancialSource[];
}

export interface CompanyProfileBlock extends CitedFinancialBlock {
  kind: "company-profile";
  company: {
    name: string;
    ticker: string;
    exchange: string;
    country: string;
    industry: string;
    description: string;
    reportingCurrency: CurrencyCode;
    asOf: ISODate;
    links?: Array<{ label: string; url: HttpsUrl }>;
    sourceIds: SourceId[];
  };
}

export interface FinancialChartBlock extends CitedFinancialBlock {
  kind: "financial-chart";
  title: string;
  chart: "line" | "bar";
  x: string[];
  series: Array<{
    name: string;
    unit: FinancialUnit;
    currency?: CurrencyCode;
    precision?: 0 | 1 | 2 | 3 | 4;
    values: Array<number | null>;
    sourceIds: SourceId[];
  }>;
}

export interface FinancialMetricsBlock extends CitedFinancialBlock {
  kind: "financial-metrics";
  metrics: Array<{
    label: string;
    value: number;
    unit: FinancialUnit;
    currency?: CurrencyCode;
    precision?: 0 | 1 | 2 | 3 | 4;
    period: FinancialPeriod;
    description?: string;
    comparison?: {
      label: string;
      value: number;
      direction: "favorable" | "unfavorable" | "neutral";
    };
    sourceIds: SourceId[];
  }>;
}

export interface FinancialNewsBlock extends CitedFinancialBlock {
  kind: "financial-news";
  items: Array<{
    title: string;
    summary: string;
    sourceId: SourceId;
    relatedTickers?: string[];
    mentionedMetrics?: string[];
  }>;
}

export interface FinancialSourcesBlock extends FinancialBlockBase {
  kind: "financial-sources";
  items: FinancialSource[];
}

export type FinancialBlock =
  | CompanyProfileBlock
  | FinancialChartBlock
  | FinancialMetricsBlock
  | FinancialNewsBlock
  | FinancialSourcesBlock;
