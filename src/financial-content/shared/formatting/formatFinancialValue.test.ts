import { describe, expect, it } from "vitest";
import { formatFinancialValue } from "./formatFinancialValue";

describe("formatFinancialValue", () => {
  it("uses the specified default precision and unit markers", () => {
    expect(formatFinancialValue({ value: 16.7, unit: "percent" })).toBe("16,7\u00a0%");
    expect(formatFinancialValue({ value: 288.93, unit: "currency", currency: "USD" })).toBe("USD\u00a0288,93");
    expect(formatFinancialValue({ value: 17.8, unit: "multiple" })).toBe("17,8×");
    expect(formatFinancialValue({ value: 12345.6, unit: "number" })).toBe("12.345,60");
  });

  it.each([
    [0, "12.346"],
    [1, "12.345,7"],
    [2, "12.345,68"],
    [3, "12.345,679"],
    [4, "12.345,6789"],
  ] as const)("applies explicit precision %i", (precision, expected) => {
    expect(formatFinancialValue({ value: 12345.6789, unit: "number", precision })).toBe(expected);
  });

  it("rounds decimal ties away from zero without binary floating artifacts", () => {
    expect(formatFinancialValue({ value: 1.005, unit: "number" })).toBe("1,01");
    expect(formatFinancialValue({ value: -1.005, unit: "number" })).toBe("−1,01");
    expect(formatFinancialValue({ value: 9.99995, unit: "number", precision: 4 })).toBe("10,0000");
  });

  it("normalizes negative zero, including values rounded to zero", () => {
    expect(formatFinancialValue({ value: -0, unit: "number" })).toBe("0,00");
    expect(formatFinancialValue({ value: -0.0001, unit: "percent" })).toBe("0,0\u00a0%");
    expect(formatFinancialValue({ value: 0, unit: "multiple", precision: 0 })).toBe("0×");
  });

  it("groups large values and keeps the Unicode minus inside a currency amount", () => {
    expect(formatFinancialValue({ value: -1234567890.12, unit: "currency", currency: "COP" }))
      .toBe("COP\u00a0−1.234.567.890,12");
    expect(formatFinancialValue({ value: 1e21, unit: "number", precision: 0 }))
      .toBe("1.000.000.000.000.000.000.000");
  });

  it("rejects non-finite values and invalid runtime precision", () => {
    for (const value of [NaN, Infinity, -Infinity]) {
      expect(() => formatFinancialValue({ value, unit: "number" })).toThrow();
    }
    for (const precision of [-1, 1.5, 5] as const) {
      expect(() => formatFinancialValue({ value: 1, unit: "number", precision: precision as 0 })).toThrow();
    }
    expect(() => formatFinancialValue({ value: 1, unit: "number", precision: null as unknown as 0 })).toThrow();
    expect(formatFinancialValue({ value: 1, unit: "number", precision: undefined })).toBe("1,00");
  });

  it("rejects incompatible or malformed currency and unit arguments", () => {
    expect(() => formatFinancialValue({ value: 1, unit: "currency" })).toThrow();
    expect(() => formatFinancialValue({ value: 1, unit: "number", currency: "USD" })).toThrow();
    expect(() => formatFinancialValue({ value: 1, unit: "currency", currency: "usd" })).toThrow();
    expect(() => formatFinancialValue({ value: 1, unit: "bad" as "number" })).toThrow();
  });
});
