import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OfficialThemeCatalog } from "../../server/infraestructure/OfficialThemeCatalog";
import { InMemoryThemeRepository } from "../../server/infraestructure/repository/InMemoryThemeRepository";
import { ResolveTheme } from "../../server/application/ResolveTheme";
import { CompileTheme } from "../../server/application/CompileTheme";

const read = (path: string) => readFileSync(path, "utf8");

const businessPresentationFiles = [
  "src/auth/browser/ui/AuthForm.astro",
  "src/profiles/browser/ui/ProfileForm.astro",
  "src/profiles/browser/ui/ProfilePage.astro",
  "src/nanobooks/browser/ui/NanobookCard.astro",
  "src/nanobooks/browser/ui/NanobooksPage.astro",
  "src/documents/browser/ui/EditorController.astro",
  "src/documents/browser/ui/components/DocumentEditor.astro",
  "src/documents/browser/ui/components/EditorStatus.astro",
  "src/documents/browser/ui/components/EditorToolbar.astro",
  "src/documents/browser/ui/components/TableOfContents/TocIndicator.astro",
  "src/documents/browser/ui/components/TableOfContents/TocNav.astro",
  "src/documents/browser/ui/components/TableOfContents/TocToggle.astro",
  "src/documents/browser/ui/pages/DocumentPage.astro",
  "src/documents/browser/ui/pages/EditPage.astro",
  "src/documents/browser/ui/pages/NewPage.astro",
  "src/navigation/browser/ui/components/Breadcrumb.astro",
  "src/navigation/browser/ui/components/IndexList/DocumentIndex.astro",
  "src/navigation/browser/ui/components/IndexList/index.astro",
  "src/navigation/browser/ui/components/SidebarNav/CloseSidebar.astro",
  "src/navigation/browser/ui/components/SidebarNav/index.astro",
  "src/navigation/browser/ui/components/SidebarNav/OpenSidebar.astro",
  "src/navigation/browser/ui/components/SidebarNav/SidebarHeader.astro",
  "src/navigation/browser/ui/components/SidebarNav/SidebarList.astro",
  "src/navigation/browser/ui/components/SidebarNav/SidebarModeToggle.astro",
  "src/navigation/browser/ui/components/SidebarNav/ToolTip.astro",
  "src/toast/browser/ToastHost.astro",
  "src/pages/verify-email.astro",
];

describe("official theme styles", () => {
  it.each(["classic", "nanobook"] as const)("compiles both palettes for %s", async (theme) => {
    const resolved = await new ResolveTheme(
      new OfficialThemeCatalog(),
      new InMemoryThemeRepository(),
    ).execute({ kind: "official", id: theme });
    const css = new CompileTheme().execute(resolved).cssText;
    expect(css).toContain(":root[data-theme-key]");
    for (const mode of ["light", "dark"]) {
      for (const token of [
        "page-bg",
        "surface-bg",
        "text",
        "text-muted",
        "accent",
        "border",
        "border-subtle",
        "font-body",
        "font-heading",
        "font-code",
        "control-radius",
        "panel-radius",
        "content-gap",
        "page-pattern",
      ]) {
        expect(css).toContain(`--theme-${mode}-${token}:`);
      }
    }
  });

  it("applies resolved theme attributes and variables in both layouts", () => {
    for (const layout of ["Layout.astro", "LandingLayout.astro"]) {
      const source = read(`src/layouts/${layout}`);
      expect(source).toContain("data-theme={theme.baseId}");
      expect(source).toContain("data-theme-key={theme.key}");
      expect(source).toContain("data-color-mode={colorModePreference}");
      expect(source).toContain("themeModule.compileTheme.execute(theme)");
      expect(source).toContain("installation.cssText");
      expect(source).toContain("installation.variables");
    }
  });

  it("uses the semantic contract in shared visual primitives", () => {
    const files = [
      "src/shared/styles/base.css",
      "src/shared/styles/prose.css",
      "src/shared/styles/utilities.css",
      "src/shared/styles/components/hatch.css",
      "src/shared/styles/components/index-card.css",
      "src/layouts/components/LayoutShell.astro",
      "src/layouts/components/Header.astro",
      "src/layouts/components/Footer.astro",
      "src/documents/browser/ui/components/DocumentActionLink.astro",
      "src/layouts/components/ContentWidthToggle.astro",
      "src/layouts/components/StateRestoreScripts.astro",
      "src/theme/browser/components/ColorModeToggle.astro",
      "src/theme/browser/styles/contract.css",
    ];

    for (const file of files) {
      const source = read(file);
      expect(source, file).not.toMatch(
        /var\(--(?:bg|text|muted|accent|grid-line(?:-strong|-subtle)?)\)/,
      );
      expect(source, file).not.toMatch(/\.light\b|classList\.toggle\(["']light["']/);
    }

    const contract = read("src/theme/browser/styles/contract.css");
    const prose = read("src/shared/styles/prose.css");
    expect(contract).toContain("--theme-content-inline-code-bg");
    expect(contract).toContain("--theme-content-block-code-bg");
    expect(prose).toContain("var(--theme-content-inline-code-bg)");
    expect(prose).toContain("var(--theme-content-block-code-bg)");
    expect(prose).toContain('pre[data-language="plaintext"]');
    expect(prose).toContain("--theme-content-block-code-text");
  });

  it("stores the color mode in a cookie and only migrates legacy storage", () => {
    const toggle = read("src/theme/browser/components/ColorModeToggle.astro");
    const restore = read("src/layouts/components/StateRestoreScripts.astro");
    expect(toggle).toContain("nanobook-color-mode=${next}");
    expect(toggle).toContain("root.dataset.colorMode = next");
    expect(toggle).not.toContain("localStorage");
    expect(restore).toContain('localStorage.getItem("theme")');
    expect(restore).toContain('localStorage.removeItem("theme")');
    expect(restore).not.toContain("classList");
  });

  it("keeps color mode deterministic and excludes the removed system mode", () => {
    const preference = read("src/theme/server/application/ColorModePreference.ts");
    const toggle = read("src/theme/browser/components/ColorModeToggle.astro");
    const contract = read("src/theme/browser/styles/contract.css");
    const prose = read("src/shared/styles/prose.css");

    expect(preference).toContain('ColorModePreference = "light" | "dark"');
    expect(preference).toContain(': "light";');
    expect(toggle).toContain('root.dataset.colorMode || "light"');
    expect(toggle).not.toContain("matchMedia");
    for (const source of [toggle, contract, prose]) {
      expect(source).not.toContain('data-color-mode="system"');
      expect(source).not.toContain("prefers-color-scheme");
    }
    for (const unusedRole of [
      "--theme-danger",
      "--theme-focus-ring",
      "--theme-content-code-bg",
      "--theme-content-code-text",
      "--theme-content-code-border",
      "--theme-content-code-grid",
      "--theme-content-code-glow",
      "--theme-content-table-header-bg",
      "--theme-decoration-grid",
      "--theme-decoration-overlay",
    ]) {
      expect(contract).not.toContain(unusedRole);
    }
  });

  it("keeps business presentation on semantic theme tokens", () => {
    for (const file of businessPresentationFiles) {
      const source = read(file);
      expect(source, file).not.toMatch(
        /var\(--(?:bg|text|muted|accent|grid-line(?:-strong|-subtle)?)\)/,
      );
      expect(source, file).not.toMatch(/\b(?:bg-black|text-white|text-black|border-black)\b/);
      expect(source, file).not.toMatch(/#(?:050505|f5f5f7|1a1a1a|e5e5e5|777777|737373)\b/i);
    }
  });
});
