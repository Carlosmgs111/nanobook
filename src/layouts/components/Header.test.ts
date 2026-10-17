import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("navigation shell", () => {
  it("resolves account state on the server and keeps project destinations in the header", () => {
    const layout = read("src/layouts/Layout.astro");
    const shell = read("src/layouts/components/LayoutShell.astro");
    const header = read("src/layouts/components/Header.astro");

    expect(layout).toContain("app.authServerModule.getSession(Astro.request)");
    expect(shell).toContain("userName={userName}");
    expect(header).toContain('href="/"');
    expect(header).toContain('href="/#nanobooks-publicos"');
    expect(header).toContain('href="/nanobooks"');
    expect(header).toContain('href="/themes"');
    expect(header).toContain('href="/profile"');
    expect(header).toContain("Ingresar");
    expect(header).not.toContain("editHref");
    expect(header).not.toContain("newHref");
  });

  it("keeps document actions beside the content and checks owner permission", () => {
    const page = read("src/documents/browser/ui/pages/DocumentPage.astro");
    const index = read("src/navigation/browser/ui/components/IndexList/index.astro");
    const editor = read("src/documents/browser/ui/pages/EditPage.astro");

    expect(page).toContain("new AuthorizeNanobook().canWrite(nanobook, user?.id)");
    expect(page).toContain('canEdit && <DocumentActionLink href={editHref} label="Editar" />');
    expect(page).toContain("canEdit && entry.isIndex");
    expect(index).toContain('label="Nuevo en esta sección"');
    expect(editor).toContain('label="Volver al documento"');
  });
});
