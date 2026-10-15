import { describe, expect, it } from "vitest";
import { Nanobook } from "../../nanobooks/server/domain/Nanobook";
import { Theme } from "../../theme/server/domain/Theme";
import { ResolveTheme } from "../../theme/server/application/ResolveTheme";
import { OfficialThemeCatalog } from "../../theme/server/infraestructure/OfficialThemeCatalog";
import { InMemoryThemeRepository } from "../../theme/server/infraestructure/repository/InMemoryThemeRepository";
import { resolveEffectiveNanobookTheme } from "./resolveEffectiveNanobookTheme";

const book = (settings: Record<string, unknown>) => Nanobook.create({ id: "book", ownerId: "owner", slug: "book", name: "Book", settings: settings as never }).getValue();
const custom = Theme.create({ id: "custom", ownerId: "owner", name: "Custom", baseThemeId: "nanobook", tokens: { light: { accent: "#3159d8" } } }).getValue();
const resolver = new ResolveTheme(new OfficialThemeCatalog(), new InMemoryThemeRepository([custom]));

describe("effective nanobook theme", () => {
  it("keeps existing books on classic", async () => {
    expect((await resolveEffectiveNanobookTheme(book({}), resolver)).key).toBe("official:classic");
  });
  it("uses assigned official and custom themes", async () => {
    expect((await resolveEffectiveNanobookTheme(book({ theme: { kind: "official", id: "nanobook" } }), resolver)).key).toBe("official:nanobook");
    expect((await resolveEffectiveNanobookTheme(book({ theme: { kind: "custom", id: "custom" } }), resolver)).lightVariables["--theme-light-accent"]).toBe("#3159d8");
  });
  it("falls back completely when a custom theme is missing", async () => {
    const result = await resolveEffectiveNanobookTheme(book({ theme: { kind: "custom", id: "missing" } }), resolver);
    expect(result.key).toBe("official:classic");
    expect(result.lightVariables["--theme-light-page-bg"]).toBe("#f5f5f7");
  });
});
