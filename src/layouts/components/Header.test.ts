import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("navigation shell", () => {
  it("reuses an account state supplied by the route and keeps project destinations in the header", () => {
    const layout = read("src/layouts/Layout.astro");
    const shell = read("src/layouts/components/LayoutShell.astro");
    const header = read("src/layouts/components/Header.astro");

    expect(layout).toContain('Object.hasOwn(Astro.props, "session")');
    expect(layout).toContain("const session = hasSuppliedSession");
    expect(shell).toContain("userName={userName}");
    expect(header).toContain('href="/"');
    expect(header).toContain('href="/#nanobooks-publicos"');
    expect(header).toContain('href="/nanobooks"');
    expect(header).toContain('href="/themes"');
    expect(header).toContain('href="/profile"');
    expect(header).toContain("Ingresar");
    expect(header).toContain("data-auth-required");
    expect(header).toContain("data-auth-anonymous");
    expect(shell).toContain("AuthStatusController");
    expect(header).not.toContain("editHref");
    expect(header).not.toContain("newHref");
  });

  it("keeps document actions beside the content and checks owner permission", () => {
    const page = read("src/documents/browser/ui/pages/DocumentPage.astro");
    const index = read("src/navigation/browser/ui/components/IndexList/index.astro");
    const editor = read("src/documents/browser/ui/pages/EditPage.astro");
    const action = read("src/documents/browser/ui/components/DocumentActionLink.astro");

    expect(page).toContain("new AuthorizeNanobook().canWrite(nanobook, user?.id)");
    expect(page).toContain("session={user}");
    expect(page).toContain("canEdit || deferOwnerActions");
    expect(page).toContain("deferSessionUi={deferOwnerActions}");
    expect(action).toContain("data-auth-owner-only");
    expect(index).toContain('label="Nuevo en esta sección"');
    expect(editor).toContain('label="Volver al documento"');
  });

  it("does not make Layout reread a session already required by workspace pages", () => {
    const nanobooksPage = read("src/nanobooks/browser/ui/NanobooksPage.astro");
    const themesPage = read("src/theme/browser/ui/ThemesPage.astro");

    expect(nanobooksPage).toContain("session={session}");
    expect(themesPage).toContain("session={session}");
  });
});
