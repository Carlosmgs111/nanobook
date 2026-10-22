import { describe, expect, it } from "vitest";

import { Theme } from "./Theme";

const validTheme = (overrides: Record<string, unknown> = {}) => ({
  id: "theme-1",
  ownerId: "owner-1",
  name: "Editorial",
  baseThemeId: "nanobook" as const,
  tokens: {},
  ...overrides,
});

describe("Theme", () => {
  it("creates a reusable theme from validated overrides", () => {
    const result = Theme.create(validTheme({
      tokens: {
        light: { accent: "#3159d8" },
        dark: { accent: "#8ca7ff" },
        typography: { family: "editorial-serif" },
        shape: { radius: "soft" },
        layout: { density: "relaxed" },
        decoration: { pattern: "none" },
      },
    }));
    expect(result.isSuccess).toBe(true);
  });

  it("accepts safe cover and decoration presets", () => {
    const result = Theme.create(validTheme({
      tokens: {
        shape: { cover: "book" },
        decoration: { corners: "line", shadow: "offset", pattern: "hatch", pagePattern: "none" },
      },
    }));

    expect(result.isSuccess).toBe(true);
  });

  it("accepts subtle texture and diagonal stripe patterns", () => {
    const result = Theme.create(validTheme({
      tokens: { decoration: { pattern: "stripes", patternScale: "coarse", patternContrast: "balanced" } },
    }));

    expect(result.isSuccess).toBe(true);
  });

  it("migrates legacy page patterns into the global pattern primitive", () => {
    const result = Theme.create(validTheme({
      tokens: { decoration: { pattern: "stripes", pagePattern: "grid" } },
    }));
    expect(result.isSuccess).toBe(true);
    expect(result.getValue().getTokens().decoration).toEqual({ pattern: "stripes" });

    const pageOnly = Theme.create(validTheme({ tokens: { decoration: { pagePattern: "grid" } } }));
    expect(pageOnly.getValue().getTokens().decoration).toEqual({ pattern: "grid" });
  });

  it("accepts common color and typography overrides", () => {
    const result = Theme.create(validTheme({ tokens: {
      light: { borderSubtle: "#ddeeff", accentText: "#ffffff", statusError: "#cc2222", statusWarning: "#aa7700", statusSuccess: "#008855", statusInfo: "#2255aa" },
      typography: { heading: "editorial-serif", code: "mono", scale: "large" },
    } }));
    expect(result.isSuccess).toBe(true);
  });

  it.each([
    { light: { accent: "red;display:none" } },
    { typography: { family: "url(https://example.com/font)" } },
    { shape: { cover: "untrusted-css" } },
    { decoration: { corners: "star" } },
    { decoration: { shadow: "blur(100px)" } },
    { unknown: "value" },
  ])("rejects unsafe or unknown tokens", (tokens) => {
    expect(Theme.create(validTheme({ tokens })).isSuccess).toBe(false);
  });

  it.each([
    { id: " ", message: "id" },
    { ownerId: " ", message: "ownerId" },
    { name: " ", message: "name" },
    { name: "x".repeat(81), message: "80" },
    { baseThemeId: "missing", message: "baseThemeId" },
  ])("rejects invalid persisted invariants", ({ message, ...overrides }) => {
    const result = Theme.create(validTheme(overrides));
    expect(result.isSuccess).toBe(false);
    expect(result.getError().message).toContain(message);
  });
});
