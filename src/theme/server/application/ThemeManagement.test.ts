import { describe, expect, it } from "vitest";

import { Theme } from "../domain/Theme";
import { InMemoryThemeRepository } from "../infraestructure/repository/InMemoryThemeRepository";
import { CreateTheme } from "./CreateTheme";
import { GetAssignableTheme } from "./GetAssignableTheme";
import { GetTheme } from "./GetTheme";
import { ListThemes } from "./ListThemes";
import { UpdateTheme } from "./UpdateTheme";

const existing = (id = "owned", ownerId = "owner-1") => Theme.create({
  id, ownerId, name: "Editorial", baseThemeId: "nanobook",
  tokens: { light: { accent: "#3159d8" } },
}).getValue();

describe("theme management", () => {
  it("creates a server-identified theme and returns safe details", async () => {
    const repository = new InMemoryThemeRepository();
    const result = await new CreateTheme(repository, () => "generated-id").execute("owner-1", {
      name: " Editorial ", baseThemeId: "nanobook",
      tokens: { light: { accent: "#3159d8", pageBackground: "#fafafa" } },
    });
    expect(result.isSuccess).toBe(true);
    expect(result.getValue()).toMatchObject({
      reference: { kind: "custom", id: "generated-id" }, name: "Editorial", editable: true,
      tokens: { light: { accent: "#3159d8", pageBackground: "#fafafa" } },
    });
  });

  it("round trips the extended public tokens through the DTO", async () => {
    const repository = new InMemoryThemeRepository();
    const created = await new CreateTheme(repository, () => "extended").execute("owner-1", {
      name: "Extended", baseThemeId: "classic",
      tokens: {
        light: { borderSubtle: "#ddddee", accentText: "#ffffff", statusWarning: "#996600" },
        dark: { statusSuccess: "#22cc99" },
        typography: { heading: "editorial-serif", code: "mono", scale: "large" },
        decoration: { pattern: "grid", patternScale: "fine", patternContrast: "balanced" },
      },
    });
    expect(created.isSuccess).toBe(true);
    const fetched = await new GetTheme(repository).execute("owner-1", "extended");
    expect(fetched.getValue().tokens).toEqual(created.getValue().tokens);
  });

  it("returns migrated pattern tokens without the retired page field", async () => {
    const legacy = Theme.create({
      id: "legacy", ownerId: "owner-1", name: "Legacy", baseThemeId: "classic",
      tokens: { decoration: { pagePattern: "grid" } },
    }).getValue();
    const result = await new GetTheme(new InMemoryThemeRepository([legacy])).execute("owner-1", "legacy");

    expect(result.getValue().tokens.decoration).toEqual({ pattern: "grid" });
  });

  it("lists official choices and only custom themes owned by the caller", async () => {
    const repository = new InMemoryThemeRepository([existing(), existing("foreign", "owner-2")]);
    const result = await new ListThemes(repository).execute("owner-1");
    expect(result.getValue().map((theme) => theme.reference)).toEqual([
      { kind: "official", id: "classic" }, { kind: "official", id: "nanobook" },
      { kind: "official", id: "herbario" }, { kind: "official", id: "plano" },
      { kind: "official", id: "monocromo" },
      { kind: "custom", id: "owned" },
    ]);
  });

  it("returns editable details only to the owner", async () => {
    const get = new GetTheme(new InMemoryThemeRepository([existing()]));
    expect((await get.execute("owner-1", "owned")).getValue().tokens.light?.accent).toBe("#3159d8");
    expect((await get.execute("owner-2", "owned")).getError().name).toBe("ThemeAccessDeniedError");
  });

  it("updates only name and tokens while preserving identity and base", async () => {
    const repository = new InMemoryThemeRepository([existing()]);
    const result = await new UpdateTheme(repository).execute("owner-1", "owned", {
      name: "Nuevo", tokens: { dark: { accent: "#8ca7ff" } },
    });
    expect(result.getValue()).toMatchObject({ name: "Nuevo", baseThemeId: "nanobook" });
    expect((await new UpdateTheme(repository).execute("owner-2", "owned", { name: "Intruso" })).getError().name)
      .toBe("ThemeAccessDeniedError");
  });

  it("accepts assignable official and owned custom references", async () => {
    const get = new GetAssignableTheme(new InMemoryThemeRepository([existing(), existing("foreign", "owner-2")]));
    expect((await get.execute("owner-1", { kind: "official", id: "classic" })).isSuccess).toBe(true);
    expect((await get.execute("owner-1", { kind: "official", id: "missing" })).isSuccess).toBe(false);
    expect((await get.execute("owner-1", { kind: "custom", id: "owned" })).isSuccess).toBe(true);
    expect((await get.execute("owner-1", { kind: "custom", id: "foreign" })).isSuccess).toBe(false);
  });
});
