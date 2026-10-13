import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("global login link contract", () => {
  it("threads loginHref through the layout shell and header", () => {
    const layout = read("src/layouts/Layout.astro");
    const shell = read("src/layouts/components/LayoutShell.astro");
    const header = read("src/layouts/components/Header.astro");

    expect(layout).toContain("loginHref");
    expect(shell).toContain("loginHref");
    expect(header).toContain("loginHref");
    expect(layout).toContain('loginHref = "/login"');
    expect(header).toContain("Ingresar");
  });

  it("does not render the login link on the profile page", () => {
    const header = read("src/layouts/components/Header.astro");

    expect(header).toContain('const isProfilePage = Astro.url.pathname === "/profile"');
    expect(header).toContain("loginHref && !isProfilePage");
  });

  it("resolves authentication through the browser application", () => {
    const header = read("src/layouts/components/Header.astro");
    const authForm = read("src/auth/browser/AuthFormController.astro");

    expect(header).toContain("getApp()");
    expect(authForm).toContain("getApp()");
    expect(header).not.toMatch(/import\s+\{\s*authModule\s*\}\s+from\s+["']\.\.\/auth["']/);
    expect(authForm).not.toMatch(/import\s+\{\s*authModule\s*\}\s+from\s+["']\.\/["']/);
  });
});
