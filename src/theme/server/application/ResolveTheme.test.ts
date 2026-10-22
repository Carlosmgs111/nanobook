import { describe, expect, it } from "vitest";

import { OfficialThemeCatalog } from "../infraestructure/OfficialThemeCatalog";
import { Theme } from "../domain/Theme";
import { InMemoryThemeRepository } from "../infraestructure/repository/InMemoryThemeRepository";
import { ResolveTheme } from "./ResolveTheme";

describe("ResolveTheme", () => {
  it("uses classic when the nanobook has no selected theme", async () => {
    const result = await new ResolveTheme(
      new OfficialThemeCatalog(),
      new InMemoryThemeRepository(),
    ).execute(undefined);

    expect(result.key).toBe("official:classic");
  });

  it("resolves the complete classic theme", async () => {
    const result = await new ResolveTheme(new OfficialThemeCatalog(), new InMemoryThemeRepository()).execute({
      kind: "official",
      id: "classic",
    });

    expect(result).toMatchObject({
      key: "official:classic",
      baseId: "classic",
    });
    expect(result.darkVariables["--theme-dark-page-bg"]).toBe("#131517");
    expect(Object.keys(result.lightVariables)).toEqual(
      Object.keys(result.darkVariables).map((key) => key.replace("--theme-dark-", "--theme-light-")),
    );
  });

  it("resolves official identity presets for both themes", async () => {
    const resolver = new ResolveTheme(new OfficialThemeCatalog(), new InMemoryThemeRepository());
    const nanobook = await resolver.execute({ kind: "official", id: "nanobook" });
    const classic = await resolver.execute({ kind: "official", id: "classic" });

    expect(nanobook.lightVariables["--theme-light-cover-radius"]).toBe("3px 9px 9px 3px");
    expect(nanobook.lightVariables["--theme-light-cover-spine-width"]).toBe("12px");
    expect(nanobook.lightVariables["--theme-light-decoration-corner-image"]).toBe("none");
    expect(nanobook.lightVariables["--theme-light-decoration-pattern-image"]).toContain("var(--theme-decoration-pattern-color)");
    expect(nanobook.lightVariables["--theme-light-decoration-shadow"]).toBe("none");
    expect(classic.lightVariables["--theme-light-cover-radius"]).toBe("0px");
    expect(classic.lightVariables["--theme-light-decoration-corner-image"]).toBe("none");
    expect(classic.lightVariables["--theme-light-decoration-shadow"]).toBe("none");
    expect(classic.lightVariables["--theme-light-decoration-pattern-image"]).toContain("linear-gradient(");
    expect(classic.darkVariables["--theme-dark-decoration-pattern-image"]).toContain("linear-gradient(");
    expect(classic.lightVariables["--theme-light-decoration-pattern-image"]).toContain("var(--theme-decoration-pattern-color)");
    expect(classic.lightVariables["--theme-light-decoration-pattern-step"]).toBe("32px");
    expect(nanobook.lightVariables["--theme-light-decoration-pattern-contrast"]).toBe("4%");
  });

  it("falls back to classic for an unknown official id", async () => {
    const result = await new ResolveTheme(new OfficialThemeCatalog(), new InMemoryThemeRepository()).execute({
      kind: "official",
      id: "missing",
    });

    expect(result.key).toBe("official:classic");
    expect(result.baseId).toBe("classic");
  });

  it("overlays validated custom tokens on the selected official base", async () => {
    const custom = Theme.create({
      id: "custom-1", ownerId: "owner-1", name: "Editorial", baseThemeId: "nanobook",
      tokens: {
        light: { accent: "#3159d8" }, dark: { accent: "#8ca7ff" },
        typography: { family: "editorial-serif" }, shape: { radius: "soft" },
        layout: { density: "relaxed" }, decoration: { pattern: "none" },
      },
    }).getValue();
    const result = await new ResolveTheme(
      new OfficialThemeCatalog(), new InMemoryThemeRepository([custom]),
    ).execute({ kind: "custom", id: "custom-1" });

    expect(result.key).toBe("custom:custom-1");
    expect(result.baseId).toBe("nanobook");
    expect(result.lightVariables["--theme-light-accent"]).toBe("#3159d8");
    expect(result.darkVariables["--theme-dark-accent"]).toBe("#8ca7ff");
    expect(result.lightVariables["--theme-light-font-heading"]).toContain("Georgia");
    expect(result.lightVariables["--theme-light-panel-radius"]).toBe("5px");
  });

  it("resolves extended palette and typography roles in both modes", async () => {
    const custom = Theme.create({
      id: "extended", ownerId: "owner-1", name: "Extended", baseThemeId: "classic",
      tokens: {
        light: { borderSubtle: "#ddddee", accentText: "#ffffff", statusError: "#aa2222" },
        dark: { statusSuccess: "#22cc99" },
        typography: { heading: "editorial-serif", code: "system-sans", scale: "large" },
      },
    }).getValue();
    const result = await new ResolveTheme(
      new OfficialThemeCatalog(), new InMemoryThemeRepository([custom]),
    ).execute({ kind: "custom", id: "extended" });

    expect(result.lightVariables["--theme-light-border-subtle"]).toBe("#ddddee");
    expect(result.lightVariables["--theme-light-accent-text"]).toBe("#ffffff");
    expect(result.lightVariables["--theme-light-status-error"]).toBe("#aa2222");
    expect(result.darkVariables["--theme-dark-status-success"]).toBe("#22cc99");
    expect(result.lightVariables["--theme-light-font-heading"]).toContain("Georgia");
    expect(result.darkVariables["--theme-dark-font-code"]).toContain("system-ui");
    expect(result.darkVariables["--theme-dark-font-scale"]).toBe("1.125rem");
    expect(result.lightVariables["--theme-light-font-body"]).toBe("system-ui, sans-serif");
  });

  it("inherits new identity presets for legacy custom themes and allows overrides", async () => {
    const legacy = Theme.create({
      id: "legacy", ownerId: "owner-1", name: "Legacy", baseThemeId: "nanobook", tokens: {},
    }).getValue();
    const customized = Theme.create({
      id: "custom-cover", ownerId: "owner-1", name: "Plain", baseThemeId: "nanobook",
      tokens: { shape: { cover: "square" }, decoration: { corners: "none", shadow: "flat", pattern: "none" } },
    }).getValue();
    const resolver = new ResolveTheme(new OfficialThemeCatalog(), new InMemoryThemeRepository([legacy, customized]));
    const inherited = await resolver.execute({ kind: "custom", id: "legacy" });
    const overridden = await resolver.execute({ kind: "custom", id: "custom-cover" });

    expect(inherited.lightVariables["--theme-light-cover-spine-width"]).toBe("12px");
    expect(inherited.lightVariables["--theme-light-decoration-shadow"]).toBe("none");
    expect(overridden.lightVariables["--theme-light-cover-spine-width"]).toBe("0px");
    expect(overridden.lightVariables["--theme-light-decoration-corner-image"]).toBe("none");
    expect(overridden.lightVariables["--theme-light-decoration-pattern-image"]).toBe("none");
    expect(overridden.lightVariables["--theme-light-decoration-shadow"]).toBe("none");
  });

  it("migrates persisted page patterns into the global primitive", async () => {
    const legacy = Theme.create({
      id: "legacy-hatch", ownerId: "owner-1", name: "Legacy hatch", baseThemeId: "nanobook",
      tokens: { decoration: { pagePattern: "grid" } },
    }).getValue();
    const resolved = await new ResolveTheme(new OfficialThemeCatalog(), new InMemoryThemeRepository([legacy]))
      .execute({ kind: "custom", id: "legacy-hatch" });

    expect(resolved.lightVariables["--theme-light-decoration-pattern-image"]).toContain("var(--theme-decoration-pattern-color)");
  });

  it("resolves global pattern primitives for all potential consumers", async () => {
    const custom = Theme.create({
      id: "global-pattern", ownerId: "owner-1", name: "Global pattern", baseThemeId: "classic",
      tokens: { decoration: { pattern: "grid", patternScale: "fine", patternContrast: "strong" } },
    }).getValue();
    const result = await new ResolveTheme(new OfficialThemeCatalog(), new InMemoryThemeRepository([custom]))
      .execute({ kind: "custom", id: "global-pattern" });

    expect(result.lightVariables["--theme-light-decoration-pattern-image"]).toContain("var(--theme-decoration-pattern-color)");
    expect(result.darkVariables["--theme-dark-decoration-pattern-step"]).toBe("12px");
    expect(result.lightVariables["--theme-light-decoration-pattern-contrast"]).toBe("14%");
  });

  it("falls back to the complete classic theme when a custom theme is missing", async () => {
    const result = await new ResolveTheme(
      new OfficialThemeCatalog(), new InMemoryThemeRepository(),
    ).execute({ kind: "custom", id: "missing" });
    expect(result.key).toBe("official:classic");
    expect(result.lightVariables["--theme-light-page-bg"]).toBe("#f1f2f4");
    expect(Object.keys(result.lightVariables)).toHaveLength(Object.keys(result.darkVariables).length);
  });

  it("inherits new color roles and derives dependent roles from a custom accent", async () => {
    const custom = Theme.create({
      id: "roles", ownerId: "owner-1", name: "Roles", baseThemeId: "nanobook",
      tokens: { light: { accent: "#3159d8", link: "#2144bb" }, dark: { focusRing: "#ffcc00" } },
    }).getValue();
    const resolver = new ResolveTheme(new OfficialThemeCatalog(), new InMemoryThemeRepository([custom]));
    const result = await resolver.execute({ kind: "custom", id: "roles" });

    expect(result.lightVariables["--theme-light-link"]).toBe("#2144bb");
    expect(result.lightVariables["--theme-light-focus-ring"]).toBe("#3159d8");
    expect(result.lightVariables["--theme-light-selection-bg"]).toBe("#3159d8");
    expect(result.lightVariables["--theme-light-selection-text"]).toBe("#fffaf4");
    expect(result.lightVariables["--theme-light-surface-raised"]).toContain("color-mix");
    expect(result.darkVariables["--theme-dark-focus-ring"]).toBe("#ffcc00");
    expect(result.darkVariables["--theme-dark-link"]).toBe("#e1a17f");
  });

  it("uses the available width by default and keeps custom reading measures", async () => {
    const custom = Theme.create({
      id: "reading", ownerId: "owner-1", name: "Reading", baseThemeId: "nanobook",
      tokens: { typography: { rhythm: "airy" }, layout: { readingMeasure: "narrow" } },
    }).getValue();
    const resolver = new ResolveTheme(new OfficialThemeCatalog(), new InMemoryThemeRepository([custom]));
    const result = await resolver.execute({ kind: "custom", id: "reading" });
    const legacy = await resolver.execute({ kind: "official", id: "nanobook" });
    expect(result.lightVariables["--theme-light-reading-measure"]).toBe("60ch");
    expect(result.darkVariables["--theme-dark-body-line-height"]).toBe("1.9");
    expect(legacy.lightVariables["--theme-light-reading-measure"]).toBe("100%");
    expect(legacy.lightVariables["--theme-light-body-line-height"]).toBe("1.75");
  });
});
