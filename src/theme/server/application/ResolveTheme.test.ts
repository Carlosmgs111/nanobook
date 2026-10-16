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

  it("falls back to the complete classic theme when a custom theme is missing", async () => {
    const result = await new ResolveTheme(
      new OfficialThemeCatalog(), new InMemoryThemeRepository(),
    ).execute({ kind: "custom", id: "missing" });
    expect(result.key).toBe("official:classic");
    expect(result.lightVariables["--theme-light-page-bg"]).toBe("#f5f5f7");
    expect(Object.keys(result.lightVariables)).toHaveLength(Object.keys(result.darkVariables).length);
  });
});
