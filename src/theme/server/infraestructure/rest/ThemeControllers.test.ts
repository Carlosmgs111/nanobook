import { describe, expect, it } from "vitest";
import { Result } from "../../../../shared/domain/Result";
import { Theme } from "../../domain/Theme";
import { ThemeRepositoryError } from "../../domain/errors";
import { CreateTheme } from "../../application/CreateTheme";
import { GetTheme } from "../../application/GetTheme";
import { ListThemes } from "../../application/ListThemes";
import { UpdateTheme } from "../../application/UpdateTheme";
import { InMemoryThemeRepository } from "../repository/InMemoryThemeRepository";
import { ThemeCollectionController } from "./ThemeCollectionController";
import { ThemeItemController } from "./ThemeItemController";

const context = (request: Request, userId?: string, themeId?: string) => ({ request, locals: userId ? { currentUserId: userId } : {}, params: themeId ? { themeId } : {} }) as any;
const seed = () => new InMemoryThemeRepository([Theme.create({ id: "owned", ownerId: "owner-1", name: "Own", baseThemeId: "classic", tokens: {} }).getValue()]);

describe("theme controllers", () => {
  it("returns 401 without an authenticated actor", async () => {
    const repository = seed();
    const controller = new ThemeCollectionController(new ListThemes(repository), new CreateTheme(repository));
    expect((await controller.get(context(new Request("http://localhost/api/themes")))).status).toBe(401);
  });

  it("returns 400 for invalid JSON and invalid tokens", async () => {
    const repository = seed();
    const controller = new ThemeCollectionController(new ListThemes(repository), new CreateTheme(repository, () => "new"));
    const broken = await controller.post(context(new Request("http://localhost/api/themes", { method: "POST", body: "{" }), "owner-1"));
    const invalid = await controller.post(context(new Request("http://localhost/api/themes", { method: "POST", body: JSON.stringify({ name: "Bad", baseThemeId: "classic", tokens: { light: { accent: "red;display:none" } } }) }), "owner-1"));
    expect(broken.status).toBe(400);
    expect(invalid.status).toBe(400);
  });

  it("persists safe cover and decoration presets through the API", async () => {
    const repository = new InMemoryThemeRepository();
    const controller = new ThemeCollectionController(new ListThemes(repository), new CreateTheme(repository, () => "new"));
    const response = await controller.post(context(new Request("http://localhost/api/themes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Book style",
        baseThemeId: "nanobook",
        tokens: {
          shape: { cover: "book" },
          decoration: { corners: "line", shadow: "offset", pattern: "stripes", pagePattern: "texture" },
        },
      }),
    }), "owner-1"));

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      tokens: {
        shape: { cover: "book" },
        decoration: { corners: "line", shadow: "offset", pattern: "stripes", pagePattern: "texture" },
      },
    });
  });

  it("rejects CSS values in identity presets", async () => {
    const repository = new InMemoryThemeRepository();
    const controller = new ThemeCollectionController(new ListThemes(repository), new CreateTheme(repository, () => "new"));
    const response = await controller.post(context(new Request("http://localhost/api/themes", {
      method: "POST",
      body: JSON.stringify({
        name: "Unsafe",
        baseThemeId: "nanobook",
        tokens: { decoration: { shadow: "blur(100px)", pagePattern: "none" } },
      }),
    }), "owner-1"));

    expect(response.status).toBe(400);
  });

  it("maps foreign themes to 403 and missing themes to 404", async () => {
    const repository = seed();
    const controller = new ThemeItemController(new GetTheme(repository), new UpdateTheme(repository));
    expect((await controller.get(context(new Request("http://localhost"), "owner-2", "owned"))).status).toBe(403);
    expect((await controller.get(context(new Request("http://localhost"), "owner-1", "missing"))).status).toBe(404);
  });

  it("maps repository failures to 500 without exposing their cause", async () => {
    const failure = new ThemeRepositoryError("database unavailable", { cause: new Error("secret") });
    const controller = new ThemeCollectionController({ execute: async () => Result.fail(failure) } as never, {} as never);
    const response = await controller.get(context(new Request("http://localhost"), "owner-1"));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("secret");
  });
});
