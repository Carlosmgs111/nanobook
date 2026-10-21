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
    expect(result.darkVariables["--theme-dark-page-bg"]).toBe("#050505");
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
    expect(nanobook.lightVariables["--theme-light-decoration-hatch-image"]).toContain("var(--theme-decoration-hatch-subtle)");
    expect(nanobook.lightVariables["--theme-light-decoration-shadow"]).toContain("12px 12px 0");
    expect(classic.lightVariables["--theme-light-cover-radius"]).toBe("0px");
    expect(classic.lightVariables["--theme-light-decoration-corner-image"]).toBe("none");
    expect(classic.lightVariables["--theme-light-decoration-shadow"]).toBe("none");
    expect(classic.lightVariables["--theme-light-decoration-hatch-image"]).toContain(
      "repeating-linear-gradient(135deg, var(--theme-decoration-hatch-subtle)",
    );
    expect(classic.darkVariables["--theme-dark-decoration-hatch-image"]).toContain(
      "repeating-linear-gradient(135deg, var(--theme-decoration-hatch-subtle)",
    );
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
    expect(inherited.lightVariables["--theme-light-decoration-shadow"]).toContain("12px 12px 0");
    expect(overridden.lightVariables["--theme-light-cover-spine-width"]).toBe("0px");
    expect(overridden.lightVariables["--theme-light-decoration-corner-image"]).toBe("none");
    expect(overridden.lightVariables["--theme-light-decoration-hatch-image"]).toBe("none");
    expect(overridden.lightVariables["--theme-light-decoration-shadow"]).toBe("none");
  });

  it("keeps component and page patterns independent while preserving legacy page patterns", async () => {
    const separated = Theme.create({
      id: "separated", ownerId: "owner-1", name: "Separated", baseThemeId: "nanobook",
      tokens: { decoration: { pattern: "stripes", pagePattern: "none" } },
    });
    expect(separated.isSuccess).toBe(true);
    const legacy = Theme.create({
      id: "legacy-hatch", ownerId: "owner-1", name: "Legacy hatch", baseThemeId: "nanobook",
      tokens: { decoration: { pattern: "hatch" } },
    }).getValue();
    const resolved = await new ResolveTheme(
      new OfficialThemeCatalog(), new InMemoryThemeRepository([separated.getValue(), legacy]),
    ).execute({ kind: "custom", id: "separated" });
    const legacyResolved = await new ResolveTheme(
      new OfficialThemeCatalog(), new InMemoryThemeRepository([legacy]),
    ).execute({ kind: "custom", id: "legacy-hatch" });

    expect(resolved.lightVariables["--theme-light-decoration-hatch-image"]).toContain("1px 10px");
    expect(resolved.lightVariables["--theme-light-page-pattern"]).toBe("none");
    expect(legacyResolved.lightVariables["--theme-light-page-pattern"]).toContain("var(--theme-decoration-hatch-subtle)");
  });

  it("falls back to the complete classic theme when a custom theme is missing", async () => {
    const result = await new ResolveTheme(
      new OfficialThemeCatalog(), new InMemoryThemeRepository(),
    ).execute({ kind: "custom", id: "missing" });
    expect(result.key).toBe("official:classic");
    expect(result.lightVariables["--theme-light-page-bg"]).toBe("#f5f5f7");
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
    expect(result.lightVariables["--theme-light-selection-text"]).toBe("#f7f5ef");
    expect(result.lightVariables["--theme-light-surface-raised"]).toContain("color-mix");
    expect(result.darkVariables["--theme-dark-focus-ring"]).toBe("#ffcc00");
    expect(result.darkVariables["--theme-dark-link"]).toBe("#ffffff");
  });

  it("resolves editorial rhythm and reading measure without changing legacy defaults", async () => {
    const custom = Theme.create({
      id: "reading", ownerId: "owner-1", name: "Reading", baseThemeId: "nanobook",
      tokens: { typography: { rhythm: "airy" }, layout: { readingMeasure: "narrow" } },
    }).getValue();
    const resolver = new ResolveTheme(new OfficialThemeCatalog(), new InMemoryThemeRepository([custom]));
    const result = await resolver.execute({ kind: "custom", id: "reading" });
    const legacy = await resolver.execute({ kind: "official", id: "nanobook" });
    expect(result.lightVariables["--theme-light-reading-measure"]).toBe("60ch");
    expect(result.darkVariables["--theme-dark-body-line-height"]).toBe("1.9");
    expect(legacy.lightVariables["--theme-light-reading-measure"]).toBe("72ch");
    expect(legacy.lightVariables["--theme-light-body-line-height"]).toBe("1.75");
  });
});
