import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("profile page", () => {
  it("composes the server profile view and its browser controller", () => {
    const profile = read("src/pages/profile.astro");

    expect(profile).toContain(
      'import ProfilePage from "../profiles/browser/ui/ProfilePage.astro"'
    );
    expect(profile).toContain(
      'import ProfilePageController from "../profiles/browser/ProfilePageController.astro"'
    );
    expect(profile).toContain("<ProfilePage />");
    expect(profile).toContain("<ProfilePageController />");
    expect(profile).not.toContain("<Layout");
  });

  it("offers a black sign-out action backed by the sign-out controller", () => {
    const profilePage = read("src/profiles/browser/ui/ProfilePage.astro");
    const controller = read("src/profiles/browser/ProfilePageController.astro");

    expect(profilePage).toContain("Cerrar sesión");
    expect(profilePage).toContain("data-sign-out");
    expect(controller).toContain("signOutController.execute()");
    expect(controller).toContain("getApp()");
    expect(controller).not.toContain('import { authModule }');
  });

  it("offers a black button back to the home page", () => {
    const profile = read("src/profiles/browser/ui/ProfilePage.astro");

    expect(profile).toContain('href="/"');
    expect(profile).toContain("Volver al inicio");
    expect(profile).toContain("bg-black");
    expect(profile).toContain("!text-white");
  });
});
