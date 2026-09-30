import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const formSource = () =>
  readFileSync(resolve(directory, "components/UserProfileForm.astro"), "utf8");
const statusSource = () =>
  readFileSync(resolve(directory, "components/ProfileStatus.astro"), "utf8");
const pageSource = () =>
  readFileSync(resolve(directory, "pages/UserProfilePage.astro"), "utf8");

describe("user profile component contract", () => {
  it("exposes the selectors and accessibility attributes used by the client controller", () => {
    const source = formSource();
    const status = statusSource();

    expect(source).toContain("<form");
    expect(source).toContain('name="email"');
    expect(source).toContain('name="displayName"');
    expect(status).toContain("data-profile-status");
    expect(status).toContain('aria-live="polite"');
    expect(source).toContain('for="profile-email"');
    expect(source).toContain('for="profile-display-name"');
    expect(source).toContain('type="submit"');
  });

  it("renders an unavailable branch when there is no current user id", () => {
    const source = pageSource();

    expect(source).toContain("currentUserId");
    expect(source).toContain("Perfil no disponible");
    expect(source).toContain("UserProfileForm");
  });
});
