import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("profile browser components", () => {
  it("places the profile form inside the dedicated profile page", () => {
    const page = read("src/browser/profiles/ProfilePage.astro");

    expect(page).toContain('import ProfileForm from "./ProfileForm.astro"');
    expect(page).toContain("<ProfileForm />");
  });

  it("provides username and display-name fields with a live status area", () => {
    const form = read("src/browser/profiles/ProfileForm.astro");

    expect(form).toContain('name="username"');
    expect(form).toContain('name="displayName"');
    expect(form).toContain('aria-live="polite"');
  });

  it("mounts its form controller with the HTTP profile adapter", () => {
    const form = read("src/browser/profiles/ProfileForm.astro");

    expect(form).toContain("ProfileFormController");
    expect(form).toContain("HttpProfileApi");
    expect(form).toContain("profileFormController.mount()");
  });
});
