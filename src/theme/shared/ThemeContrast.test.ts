import { describe, expect, it } from "vitest";
import { analyzeThemeContrast, contrastRatio } from "./ThemeContrast";

describe("theme contrast", () => {
  it("computes WCAG ratios and composites alpha surfaces", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 2);
    expect(contrastRatio("#000000", "rgba(255, 255, 255, 0.5)", "#000000")).toBeCloseTo(5.32, 1);
  });

  it("flags insufficient accent text contrast in each mode", () => {
    const palette = {
      "page-bg": "#ffffff", "surface-bg": "#ffffff", text: "#111111",
      "text-muted": "#333333", link: "#111111", accent: "#eeeeee",
      "accent-text": "#ffffff", "selection-bg": "#eeeeee",
      "selection-text": "#ffffff", "focus-ring": "#111111", border: "#222222",
    };
    const issues = analyzeThemeContrast({ light: palette, dark: palette });
    expect(issues.some((issue) => issue.mode === "light" && issue.pair === "accent-text/accent" && issue.ratio < 4.5)).toBe(true);
    expect(issues.some((issue) => issue.mode === "dark" && issue.pair === "selection-text/selection-bg")).toBe(true);
  });

  it("checks status colors against the surface where the preview renders them", () => {
    const palette = { "page-bg": "#ffffff", "surface-bg": "#ffffff", "status-warning": "#f59e0b" };
    expect(analyzeThemeContrast({ light: palette, dark: palette }))
      .toContainEqual(expect.objectContaining({ mode: "light", pair: "status-warning/surface-bg", status: "insufficient" }));
  });

  it("marks unsupported colors as unverifiable", () => {
    const palette = { "page-bg": "var(--unknown)", text: "#111111" };
    expect(analyzeThemeContrast({ light: palette, dark: palette }))
      .toContainEqual(expect.objectContaining({ mode: "light", pair: "text/page-bg", status: "unverifiable" }));
  });
});
