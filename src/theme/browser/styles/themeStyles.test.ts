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
  it("provides semantic interaction states and applies focus and selection", () => {
    const contract = read("src/theme/browser/styles/contract.css");
    const base = read("src/shared/styles/base.css");
    expect(contract).toContain("--theme-action-hover:");
    expect(contract).toContain("--theme-action-active:");
    expect(contract).toContain("--theme-navigation-selected-bg:");
    expect(base).toContain("::selection");
    expect(base).toContain("--theme-focus-ring");
  });
  it("shows reading measure, navigation and focus in the theme preview", () => {
    const editor = read("src/theme/browser/ui/ThemeEditor.astro");
    expect(editor).toContain("preview-reading");
    expect(editor).toContain("preview-navigation");
    expect(editor).toContain("preview-focus");
    expect(editor).toContain("--theme-light-reading-measure");
    expect(editor).toContain("--theme-dark-reading-measure");
  });
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
        "accent-text",
        "status-error",
        "status-warning",
        "status-success",
        "status-info",
        "border",
        "border-subtle",
        "font-body",
        "font-heading",
        "font-code",
        "font-scale",
        "control-radius",
        "panel-radius",
        "content-gap",
        "cover-radius",
        "cover-spine-width",
        "decoration-corner-image",
        "decoration-pattern-image",
        "decoration-pattern-step",
        "decoration-pattern-contrast",
        "decoration-shadow",
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
    expect(contract).toContain("--theme-content-block-code-bg: color-mix(in srgb, var(--theme-text) 88%, var(--theme-page-bg) 12%)");
    expect(contract).toContain("--theme-content-block-code-text: var(--theme-page-bg)");
    expect(contract).toContain("--theme-content-block-code-bg: var(--theme-surface-bg)");
    expect(contract).toContain("--theme-content-block-code-text: var(--theme-text)");
    expect(prose).toContain("var(--theme-content-inline-code-bg)");
    expect(prose).toContain("var(--theme-content-block-code-bg)");
    expect(prose).not.toContain('data-language="plaintext"');
    expect(prose).toContain("color: var(--theme-content-block-code-text)");
  });

  it("tightens line spacing only for graph code fences", () => {
    const prose = read("src/shared/styles/prose.css");

    expect(prose).toMatch(/\.prose pre\s*>\s*code\.language-graph\s*\{[^}]*line-height:\s*1;[^}]*white-space:\s*pre;/s);
    expect(prose).not.toMatch(/\.prose pre code\s*\{[^}]*line-height:/s);
  });

  it("uses identity presets across the book shell and document components", () => {
    const contract = read("src/theme/browser/styles/contract.css");
    const utilities = read("src/shared/styles/utilities.css");
    const hatch = read("src/shared/styles/components/hatch.css");
    const cards = read("src/shared/styles/components/index-card.css");
    const prose = read("src/shared/styles/prose.css");
    const shell = read("src/layouts/components/LayoutShell.astro");
    const header = read("src/layouts/components/Header.astro");
    const toc = read("src/documents/browser/ui/components/TableOfContents/TocNav.astro");
    const auth = read("src/auth/browser/ui/AuthForm.astro");
    const toast = read("src/toast/browser/ToastHost.astro");
    const verifyEmail = read("src/pages/verify-email.astro");
    const headerSource = read("src/layouts/components/Header.astro");
    const tocSource = read("src/documents/browser/ui/components/TableOfContents/TocNav.astro");
    const sidebar = read("src/navigation/browser/ui/components/SidebarNav/index.astro");
    const tooltip = read("src/navigation/browser/ui/components/SidebarNav/ToolTip.astro");
    const documentIndex = read("src/navigation/browser/ui/components/IndexList/DocumentIndex.astro");

    for (const variable of [
      "--theme-cover-radius",
      "--theme-cover-spine-width",
      "--theme-decoration-corner-image",
      "--theme-decoration-pattern-image",
      "--theme-decoration-pattern-step",
      "--theme-decoration-mark-color",
      "--theme-decoration-shadow",
    ]) {
      expect(contract).toContain(variable);
    }
    expect(utilities).toContain("var(--theme-decoration-corner-image)");
    expect(hatch).toContain("var(--theme-decoration-pattern-image)");
    expect(cards).toContain("var(--theme-decoration-pattern-image)");
    expect(cards).toContain(".index-card[data-cover] .index-card-media");
    expect(cards).toContain("background-size: cover");
    expect(cards).toContain("var(--theme-cover-radius)");
    expect(cards).toContain("var(--theme-cover-spine-width)");
    expect(cards).toContain("var(--theme-decoration-shadow)");
    expect(prose).toContain("var(--theme-decoration-corner-image)");
    expect(prose).toContain("var(--theme-decoration-pattern-image)");
    expect(shell).toContain("glass-panel corner-plus");
    expect(sidebar).not.toContain("background-image: var(--theme-decoration-pattern-image)");
    expect(sidebar).toContain("var(--theme-decoration-corner-image)");
    expect(sidebar).toContain("box-shadow: var(--theme-decoration-shadow)");
    expect(sidebar).toContain("border-radius: var(--theme-panel-radius)");
    for (const [file, source] of [["header", header], ["toc", toc], ["auth", auth], ["toast", toast], ["verify email", verifyEmail]] as const) {
      expect(source, file).toContain("var(--theme-decoration-shadow)");
    }
    for (const [file, source] of [["header", headerSource], ["toc", tocSource], ["sidebar", sidebar], ["tooltip", tooltip], ["document index", documentIndex]] as const) {
      expect(source, file).not.toMatch(/backdrop-filter|backdrop-blur/);
    }
  });

  it("exposes identity presets and book samples in the theme editor", () => {
    const editor = read("src/theme/browser/ui/ThemeEditor.astro");

    expect(editor).toContain('data-theme-field="shape.cover"');
    expect(editor).toContain('data-theme-field="decoration.corners"');
    expect(editor).toContain('data-theme-field="decoration.shadow"');
    expect(editor).toContain('data-theme-field="decoration.patternScale"');
    expect(editor).toContain('data-theme-field="decoration.patternContrast"');
    expect(editor).not.toContain('data-theme-field="decoration.pagePattern"');
    expect(editor).toContain("Textura sutil");
    expect(editor).toContain("Rayas diagonales");
    expect(editor).toContain('class="preview-book"');
    expect(editor).toContain('class="preview-card"');
    expect(editor).toContain('class="preview-markdown"');
  });

  it("keeps header menus above the compact TOC and document content below both", () => {
    const tocLayout = read("src/documents/browser/ui/components/TableOfContents/index.astro");
    const header = read("src/layouts/components/Header.astro");

    expect(tocLayout).toContain("md:z-40");
    expect(header).toContain('class="sticky top-0 z-50');
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

  it("keeps status colors and control geometry on the active theme contract", () => {
    const contract = read("src/theme/browser/styles/contract.css");
    const base = read("src/shared/styles/base.css");
    const landing = read("src/application/browser/ui/LandingPage.astro");
    const status = read("src/documents/browser/ui/components/EditorStatus.astro");
    const toolbar = read("src/documents/browser/ui/components/EditorToolbar.astro");
    const toc = read("src/documents/browser/ui/components/TableOfContents/TocNav.astro");
    const toast = read("src/toast/browser/ToastHost.astro");
    const prose = read("src/shared/styles/prose.css");
    const nanobookCard = read("src/nanobooks/browser/ui/NanobookCard.astro");
    const nanobooksPage = read("src/nanobooks/browser/ui/NanobooksPage.astro");
    const newDocumentPage = read("src/documents/browser/ui/pages/NewPage.astro");

    expect(contract).toContain("--theme-status-error:");
    expect(prose).not.toMatch(/rgba?\(/);
    expect(prose).toContain("color-mix(in srgb, var(--theme-status-warning)");
    expect(prose).toContain("color-mix(in srgb, var(--theme-status-success)");
    expect(prose).toContain("color-mix(in srgb, var(--theme-status-info)");
    expect(base).toContain("var(--theme-control-radius)");
    for (const [file, source] of [
      ["landing", landing], ["editor status", status], ["editor toolbar", toolbar],
      ["TOC", toc], ["toast", toast], ["nanobook card", nanobookCard],
      ["nanobooks page", nanobooksPage], ["new document page", newDocumentPage],
    ] as const) {
      expect(source, file).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(source, file).not.toMatch(/\b(?:text|border|bg)-(?:red|green|blue|rose|emerald|amber)-\d{2,3}\b/);
    }

    expect(status).toContain("var(--theme-status-success)");
    expect(status).toContain("var(--theme-status-error)");
    expect(toolbar).toContain("var(--theme-status-error)");
    expect(toc).toContain("var(--theme-navigation-index-card-hover)");
    expect(toc).not.toContain("#2c2c2ce2");
    expect(toc).not.toContain("#ffffff0d");
    expect(landing).toContain("var(--theme-font-body)");
    expect(landing).toContain("var(--theme-cover-radius)");
    expect(landing).toContain("var(--theme-cover-spine-width)");
    expect(landing).toContain("var(--theme-decoration-shadow)");
  });

  it("applies density and reading scale to the page layout", () => {
    const shell = read("src/layouts/components/LayoutShell.astro");
    const prose = read("src/shared/styles/prose.css");
    expect(shell).toContain("gap: var(--theme-content-gap)");
    expect(prose).toContain("margin-block-start: var(--theme-content-gap)");
    expect(prose).toContain("font-size: var(--theme-font-scale)");
  });

  it("themes header controls, the standard TOC panel, and page action controls", () => {
    const header = read("src/layouts/components/Header.astro");
    const toc = read("src/documents/browser/ui/components/TableOfContents/TocNav.astro");
    const tocToggle = read("src/documents/browser/ui/components/TableOfContents/TocToggle.astro");
    const actionLink = read("src/documents/browser/ui/components/DocumentActionLink.astro");
    const contentWidth = read("src/layouts/components/ContentWidthToggle.astro");
    const sidebarToggle = read("src/navigation/browser/ui/components/SidebarNav/SidebarModeToggle.astro");

    expect(header).toContain("background: var(--theme-page-bg)");
    expect(header).toContain("color: var(--theme-text)");
    expect(header).toContain("border-radius: var(--theme-control-radius)");
    expect(header).toContain("var(--theme-navigation-index-card-hover)");
    expect(toc).toContain("background: var(--theme-surface-bg)");
    expect(toc).toContain("border-radius: var(--theme-panel-radius)");
    expect(toc).toContain("box-shadow: var(--theme-decoration-shadow)");
    expect(toc).toContain("var(--theme-navigation-index-card-hover)");
    expect(actionLink).toContain("var(--theme-control-radius)");
    expect(tocToggle).toContain('.toc-toggle[data-toc-mode="compact"]');
    expect(contentWidth).toContain('#content-width-toggle[data-content-mode="full"]');
    expect(sidebarToggle).toContain('.sidebar-mode-toggle[data-sidebar-mode="collapsed"]');
  });
});
