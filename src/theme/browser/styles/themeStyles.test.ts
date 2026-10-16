import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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
  it.each(["classic", "nanobook"])("implements both palettes for %s", (theme) => {
    const css = read(`src/theme/browser/styles/${theme}.css`);
    expect(css).toContain(`:root[data-theme="${theme}"]`);
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
      expect(source).toContain("theme.lightVariables");
      expect(source).toContain("theme.darkVariables");
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
      "src/layouts/components/DocumentControls.astro",
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
