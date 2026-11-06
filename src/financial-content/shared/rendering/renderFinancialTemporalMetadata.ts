import type { Element, Text } from "hast";
import { formatFinancialDate } from "../formatting/formatFinancialDate";
import type { FinancialPeriod, FinancialSource, ISODate } from "../model/FinancialSource";
import { element, text } from "./hast";

export function renderFinancialTime(date: ISODate): Element {
  return element("time", [text(formatFinancialDate(date))], { dateTime: date });
}

export function renderFinancialPeriod(period: FinancialPeriod): Array<Element | Text> {
  const children: Array<Element | Text> = [text(period.label)];
  if (period.from) children.push(text(" desde "), renderFinancialTime(period.from));
  if (period.to) children.push(text(" hasta "), renderFinancialTime(period.to));
  return children;
}

export function renderSourceTemporalMetadata(source: FinancialSource): Array<Array<Element | Text>> {
  const fields: Array<Array<Element | Text>> = [];
  if (source.period) fields.push([text("Periodo "), ...renderFinancialPeriod(source.period)]);
  if (source.publishedAt) fields.push([text("Publicado "), renderFinancialTime(source.publishedAt)]);
  if (source.accessedAt) fields.push([text("Consultado "), renderFinancialTime(source.accessedAt)]);
  return fields;
}

export function renderInlineSourceTemporalMetadata(source: FinancialSource): Array<Element | Text> {
  return renderSourceTemporalMetadata(source).flatMap((field) => [text(" · "), ...field]);
}
