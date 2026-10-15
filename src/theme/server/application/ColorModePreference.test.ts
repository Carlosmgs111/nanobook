import { describe, expect, it } from "vitest";
import { normalizeColorModePreference } from "./ColorModePreference";

describe("normalizeColorModePreference", () => {
  it.each([undefined, "", "sepia", "LIGHT"])("falls back invalid %s to system", (value) => {
    expect(normalizeColorModePreference(value)).toBe("system");
  });
  it.each(["light", "dark", "system"] as const)("keeps %s", (value) => {
    expect(normalizeColorModePreference(value)).toBe(value);
  });
});
