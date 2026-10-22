import { describe, expect, it } from "vitest";
import { parseThemeTokensDto } from "./ThemeDtos";

describe("ThemeTokensDto", () => {
  it("accepts full-width Markdown content from the theme editor", () => {
    const result = parseThemeTokensDto({ layout: { readingMeasure: "full" } });
    expect(result.isSuccess).toBe(true);
    expect(result.getValue().layout?.readingMeasure).toBe("full");
  });

  it("accepts global pattern primitives", () => {
    const result = parseThemeTokensDto({
      decoration: { pattern: "grid", patternScale: "fine", patternContrast: "strong" },
    });

    expect(result.isSuccess).toBe(true);
    expect(result.getValue().decoration).toEqual({
      pattern: "grid", patternScale: "fine", patternContrast: "strong",
    });
  });

  it("rejects the retired component-specific page pattern in new API input", () => {
    expect(parseThemeTokensDto({ decoration: { pagePattern: "grid" } }).isSuccess).toBe(false);
  });
});
