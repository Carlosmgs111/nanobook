import { describe, expect, it } from "vitest";
import { normalizeColorModePreference } from "./ColorModePreference";

describe("normalizeColorModePreference", () => {
  it.each([undefined, "", "sepia", "LIGHT", "system"])("falls back invalid %s to light", (value) => {
    expect(normalizeColorModePreference(value)).toBe("light");
  });
  it.each(["light", "dark"] as const)("keeps %s", (value) => {
    expect(normalizeColorModePreference(value)).toBe(value);
  });
});
