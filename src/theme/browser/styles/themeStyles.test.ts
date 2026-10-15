import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("official theme styles", () => {
  it.each(["classic", "nanobook"])("implements both palettes for %s", (theme) => {
    const css = read(`src/theme/browser/styles/${theme}.css`);
    expect(css).toContain(`:root[data-theme="${theme}"]`);
    for (const mode of ["light", "dark"]) {
      for (const token of [
        "page-bg",
        "surface-bg",
        "text",
        "text-muted",
        "accent",
        "border",
        "border-subtle",
        "font-body",
        "font-heading",
        "font-code",
        "control-radius",
        "panel-radius",
        "content-gap",
        "page-pattern",
      ]) {
        expect(css).toContain(`--theme-${mode}-${token}:`);
      }
    }
  });

  it("applies resolved theme attributes and variables in both layouts", () => {
    for (const layout of ["Layout.astro", "LandingLayout.astro"]) {
      const source = read(`src/layouts/${layout}`);
      expect(source).toContain("data-theme={theme.baseId}");
      expect(source).toContain("data-theme-key={theme.key}");
      expect(source).toContain("data-color-mode={colorModePreference}");
      expect(source).toContain("theme.lightVariables");
      expect(source).toContain("theme.darkVariables");
    }
  });
});
