export type ISODate = string;
export type HttpsUrl = string;
export type SourceId = string;
export type CurrencyCode = string;

export type FinancialSourceType =
  | "filing"
  | "earnings"
  | "news"
  | "dataset"
  | "other";

export interface FinancialPeriod {
  label: string;
  from?: ISODate;
  to?: ISODate;
}

export interface FinancialSource {
  id: SourceId;
  label: string;
  organization?: string;
  url: HttpsUrl;
  type: FinancialSourceType;
  publishedAt?: ISODate;
  period?: FinancialPeriod;
  accessedAt?: ISODate;
}
