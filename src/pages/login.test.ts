import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("login page", () => {
  it("offers a themed way back to the home page and uses the active theme accent", () => {
    const login = read("src/auth/browser/ui/AuthForm.astro");

    expect(login).toContain('href="/"');
    expect(login).toContain("Volver al inicio");
    expect(login).toContain("background: var(--theme-accent)");
    expect(login).toContain("color: var(--theme-accent-text)");
  });
});
