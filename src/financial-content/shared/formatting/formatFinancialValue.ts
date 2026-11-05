import type { FinancialUnit } from "../model/FinancialBlock";
import type { CurrencyCode } from "../model/FinancialSource";

type Precision = 0 | 1 | 2 | 3 | 4;

function roundedMagnitude(value: number, precision: Precision): string {
  // The canonical decimal representation avoids host locale and binary
  // multiplication errors at decimal ties such as 1.005.
  const match = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(Math.abs(value).toString());
  if (!match) throw new RangeError("Invalid financial value");

  const digits = BigInt(match[1] + (match[2] ?? ""));
  const scale = (match[2]?.length ?? 0) - Number(match[3] ?? 0);
  const shift = precision - scale;
  let rounded: bigint;

  if (shift >= 0) {
    rounded = digits * 10n ** BigInt(shift);
  } else {
    const divisor = 10n ** BigInt(-shift);
    const quotient = digits / divisor;
    const remainder = digits % divisor;
    rounded = quotient + (remainder * 2n >= divisor ? 1n : 0n);
  }

  const padded = rounded.toString().padStart(precision + 1, "0");
  const whole = precision === 0 ? padded : padded.slice(0, -precision);
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return precision === 0 ? grouped : `${grouped},${padded.slice(-precision)}`;
}

export function formatFinancialValue(input: {
  value: number;
  unit: FinancialUnit;
  currency?: CurrencyCode;
  precision?: Precision;
}): string {
  if (!input || !Number.isFinite(input.value)) {
    throw new RangeError("Financial value must be finite");
  }
  if (!["number", "percent", "currency", "multiple"].includes(input.unit)) {
    throw new TypeError("Invalid financial unit");
  }
  if (input.unit === "currency") {
    if (typeof input.currency !== "string" || !/^[A-Z]{3}$/.test(input.currency)) {
      throw new TypeError("Currency must be a three-letter uppercase code");
    }
  } else if (input.currency !== undefined) {
    throw new TypeError("Currency is only valid with the currency unit");
  }

  const precision = input.precision === undefined
    ? (input.unit === "percent" || input.unit === "multiple" ? 1 : 2)
    : input.precision;
  if (!Number.isInteger(precision) || precision < 0 || precision > 4) {
    throw new RangeError("Precision must be an integer from 0 to 4");
  }

  const magnitude = roundedMagnitude(input.value, precision);
  const signed = input.value < 0 && !/^0(?:,0+)?$/.test(magnitude) ? `−${magnitude}` : magnitude;
  switch (input.unit) {
    case "percent": return `${signed}\u00a0%`;
    case "currency": return `${input.currency}\u00a0${signed}`;
    case "multiple": return `${signed}×`;
    case "number": return signed;
  }
}
