import type { ISODate } from "../model/FinancialSource";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"] as const;

export function formatFinancialDate(value: ISODate): string {
  const match = typeof value === "string" ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  if (!match) throw new RangeError("Invalid ISO civil date");

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year === 0 || month < 1 || month > 12) {
    throw new RangeError("Invalid ISO civil date");
  }

  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (day < 1 || day > daysInMonth) {
    throw new RangeError("Invalid ISO civil date");
  }

  return `${day} ${MONTHS[month - 1]} ${match[1]}`;
}
