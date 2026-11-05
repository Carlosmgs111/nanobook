import { describe, expect, it } from "vitest";
import { formatFinancialDate } from "./formatFinancialDate";

describe("formatFinancialDate", () => {
  it("formats ISO civil dates with fixed Spanish month abbreviations", () => {
    expect(formatFinancialDate("2026-10-29")).toBe("29 oct 2026");
    expect(formatFinancialDate("2024-02-29")).toBe("29 feb 2024");
    expect(formatFinancialDate("2026-01-01")).toBe("1 ene 2026");
    expect(formatFinancialDate("2026-12-31")).toBe("31 dic 2026");
  });

  it("keeps the calendar day at year and month boundaries", () => {
    expect(formatFinancialDate("2025-12-31")).toBe("31 dic 2025");
    expect(formatFinancialDate("2026-01-01")).toBe("1 ene 2026");
    expect(formatFinancialDate("2026-03-01")).toBe("1 mar 2026");
  });

  it("rejects malformed and impossible civil dates", () => {
    for (const value of [
      "2026-1-01", "2026-01-1", "2026-00-01", "2026-13-01", "2026-04-31",
      "2023-02-29", "2026-01-00", "2026-01-32", "2026-10-29T00:00:00Z",
      "0000-01-01", "1900-02-29",
    ]) {
      expect(() => formatFinancialDate(value)).toThrow();
    }
  });

  it("accepts Gregorian century leap years", () => {
    expect(formatFinancialDate("2000-02-29")).toBe("29 feb 2000");
  });
});
