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

  it.each([
    { light: { accent: "red;display:none" } },
    { typography: { family: "url(https://example.com/font)" } },
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
