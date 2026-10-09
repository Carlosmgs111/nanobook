import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("profile page", () => {
  it("renders the browser profile page component", () => {
    const profile = read("src/pages/profile.astro");

    expect(profile).toContain('import ProfilePage from "../browser/profiles/ProfilePage.astro"');
    expect(profile).toContain("<ProfilePage>");
  });

  it("offers a black sign-out action backed by the sign-out controller", () => {
    const profile = read("src/pages/profile.astro");

    expect(profile).toContain("Cerrar sesión");
    expect(profile).toContain("data-sign-out");
    expect(profile).toContain("signOutController.execute()");
    expect(profile).toContain("getApp()");
    expect(profile).not.toContain('import { authModule }');
  });

  it("offers a black button back to the home page", () => {
    const profile = read("src/browser/profiles/ProfilePage.astro");

    expect(profile).toContain('href="/"');
    expect(profile).toContain("Volver al inicio");
    expect(profile).toContain("bg-black");
    expect(profile).toContain("!text-white");
  });
});
