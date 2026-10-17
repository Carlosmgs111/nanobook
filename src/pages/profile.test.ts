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
      'import ProfileFormController from "../profiles/browser/ProfileFormController.astro"'
    );
    expect(profile).toContain("<ProfilePage />");
    expect(profile).toContain("<ProfileFormController />");
    const shell = read("src/layouts/components/LayoutShell.astro");
    expect(shell).toContain('import SignOutController from "../../profiles/browser/SignOutController.astro"');
    expect(shell).toContain("<SignOutController />");
    expect(profile).not.toContain("<Layout");
  });

  it("offers sign-out from the shared account menu", () => {
    const header = read("src/layouts/components/Header.astro");
    const controller = read("src/profiles/browser/ProfileFormController.astro");

    expect(header).toContain("Cerrar sesión");
    expect(header).toContain("data-sign-out");
    expect(controller).toContain("ProfileFormController");
    expect(controller).toContain("data-profile-form");
    expect(controller).not.toContain('import { authModule }');
  });

  it("uses the shared project link for returning home", () => {
    const profile = read("src/profiles/browser/ui/ProfilePage.astro");
    const header = read("src/layouts/components/Header.astro");
    expect(profile).toContain("<Layout");
    expect(header).toContain('aria-label="Nanobook, volver al inicio"');
  });
});
