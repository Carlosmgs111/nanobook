import { describe, expect, it, vi } from "vitest";
import { ThemeEditorController } from "./ThemeEditorController";

type Listener = (event: { preventDefault(): void }) => void | Promise<void>;
class FakeStyle { values = new Map<string, string>(); setProperty(key: string, value: string) { this.values.set(key, value); } }
class FakeElement {
  dataset: Record<string, string> = {}; value = ""; textContent = ""; disabled = false;
  style = new FakeStyle(); listeners = new Map<string, Listener[]>(); one = new Map<string, FakeElement>(); many = new Map<string, FakeElement[]>();
  querySelector(selector: string) { return this.one.get(selector) ?? null; }
  querySelectorAll(selector: string) { return this.many.get(selector) ?? []; }
  addEventListener(type: string, listener: Listener) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]); }
  async trigger(type: string) { for (const listener of this.listeners.get(type) ?? []) await listener({ preventDefault() {} }); }
}

function view() {
  const root = new FakeElement(), form = new FakeElement(), preview = new FakeElement(), toggle = new FakeElement();
  const submit = new FakeElement(), reset = new FakeElement(), notice = new FakeElement(), name = new FakeElement(), base = new FakeElement(), accent = new FakeElement();
  const cover = new FakeElement(), corners = new FakeElement(), shadow = new FakeElement(), pattern = new FakeElement(), pagePattern = new FakeElement();
  name.value = "Editorial"; base.value = "nanobook"; accent.value = "#3159d8"; accent.dataset.themeField = "light.accent";
  cover.value = "book"; cover.dataset.themeField = "shape.cover";
  corners.value = "line"; corners.dataset.themeField = "decoration.corners";
  shadow.value = "offset"; shadow.dataset.themeField = "decoration.shadow";
  pattern.value = "texture"; pattern.dataset.themeField = "decoration.pattern";
  pagePattern.value = "none"; pagePattern.dataset.themeField = "decoration.pagePattern";
  root.one.set("form", form); root.one.set("[data-theme-preview]", preview); root.one.set("[data-preview-mode-toggle]", toggle);
  root.one.set("[data-theme-submit]", submit); root.one.set("[data-theme-notice]", notice); root.one.set('[name="name"]', name); root.one.set('[name="baseThemeId"]', base);
  root.one.set("[data-theme-reset]", reset);
  root.many.set("[data-theme-field]", [accent, cover, corners, shadow, pattern, pagePattern]);
  return { root, form, preview, toggle, submit, reset, notice, name, accent, cover, corners, shadow, pattern, pagePattern };
}

describe("ThemeEditorController", () => {
  it("updates only the preview root and toggles its color mode", async () => {
    const v = view(); const outside = new FakeElement();
    const controller = new ThemeEditorController({ api: { create: vi.fn(), update: vi.fn() } as never, root: v.root as never });
    controller.mount(); await v.accent.trigger("input"); await v.toggle.trigger("click");
    expect(v.preview.style.values.get("--theme-light-accent")).toBe("#3159d8");
    expect(outside.style.values.size).toBe(0);
    expect(v.preview.dataset.previewMode).toBe("dark");
  });

  it("previews cover, corner and shadow presets", async () => {
    const v = view();
    new ThemeEditorController({ api: { create: vi.fn(), update: vi.fn() } as never, root: v.root as never }).mount();
    await v.cover.trigger("input");
    await v.corners.trigger("input");
    await v.shadow.trigger("input");

    expect(v.preview.style.values.get("--theme-light-cover-radius")).toBe("3px 9px 9px 3px");
    expect(v.preview.style.values.get("--theme-dark-cover-spine-width")).toBe("12px");
    expect(v.preview.style.values.get("--theme-light-decoration-corner-image")).toContain("linear-gradient(");
    expect(v.preview.style.values.get("--theme-dark-decoration-shadow")).toContain("12px 12px 0");
  });

  it("submits the visual preset selections", async () => {
    const v = view(); const create = vi.fn().mockResolvedValue({ reference: { id: "new" } });
    new ThemeEditorController({ api: { create, update: vi.fn() } as never, root: v.root as never }).mount();
    await v.form.trigger("submit");

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ tokens: {
      light: { accent: "#3159d8" },
      shape: { cover: "book" },
      decoration: { corners: "line", shadow: "offset", pattern: "texture", pagePattern: "none" },
    } }));
  });

  it("preserves inherited values until the user changes a field", async () => {
    const v = view(); const create = vi.fn().mockResolvedValue({ reference: { id: "new" } });
    v.accent.dataset.themeOverride = "false";
    v.cover.dataset.themeOverride = "false";
    new ThemeEditorController({ api: { create, update: vi.fn() } as never, root: v.root as never }).mount();
    await v.form.trigger("submit");
    expect(create.mock.calls[0][0].tokens.light).toBeUndefined();
    expect(create.mock.calls[0][0].tokens.shape).toBeUndefined();
    delete v.root.dataset.themeId;

    await v.accent.trigger("input");
    await v.cover.trigger("change");
    await v.form.trigger("submit");
    expect(create.mock.calls[1][0].tokens.light.accent).toBe("#3159d8");
    expect(create.mock.calls[1][0].tokens.shape.cover).toBe("book");
  });

  it("restores inheritance before saving", async () => {
    const v = view(); const create = vi.fn().mockResolvedValue({ reference: { id: "new" } });
    v.root.dataset.themeBases = JSON.stringify({ nanobook: { light: { accent: "#111111" }, dark: { accent: "#ffffff" } } });
    new ThemeEditorController({ api: { create, update: vi.fn() } as never, root: v.root as never }).mount();
    await v.reset.trigger("click");
    await v.form.trigger("submit");
    expect(create.mock.calls[0][0].tokens).toEqual({});
    expect(v.notice.textContent).toBe("Tema guardado.");
  });

  it("updates inherited preview values when the base theme changes", async () => {
    const v = view();
    v.accent.dataset.themeOverride = "false";
    v.root.dataset.themeBases = JSON.stringify({
      nanobook: { light: { accent: "#111111" }, dark: { accent: "#ffffff" } },
      classic: { light: { accent: "#222222" }, dark: { accent: "#eeeeee" } },
    });
    new ThemeEditorController({ api: { create: vi.fn(), update: vi.fn() } as never, root: v.root as never }).mount();
    v.root.one.get('[name="baseThemeId"]')!.value = "classic";
    await v.root.one.get('[name="baseThemeId"]')!.trigger("change");
    expect(v.preview.style.values.get("--theme-light-accent")).toBe("#222222");
    expect(v.accent.value).toBe("#222222");
    expect(v.accent.dataset.themeOverride).toBe("false");
  });

  it("keeps component patterns separate from the page background preview", async () => {
    const v = view();
    new ThemeEditorController({ api: { create: vi.fn(), update: vi.fn() } as never, root: v.root as never }).mount();
    const initialPagePattern = v.preview.style.values.get("--theme-light-page-pattern");
    await v.pattern.trigger("input");
    expect(v.preview.style.values.get("--theme-light-decoration-hatch-image")).toContain("var(--theme-decoration-hatch-subtle)");
    expect(v.preview.style.values.get("--theme-light-page-pattern")).toBe(initialPagePattern);

    v.pattern.value = "stripes";
    await v.pattern.trigger("input");
    expect(v.preview.style.values.get("--theme-light-decoration-hatch-image")).toContain("1px 10px");

    v.pagePattern.value = "stripes";
    await v.pagePattern.trigger("input");
    expect(v.preview.style.values.get("--theme-light-page-pattern")).toContain("2px 12px");
  });

  it("rejects an empty name before HTTP", async () => {
    const v = view(); v.name.value = " "; const create = vi.fn();
    new ThemeEditorController({ api: { create, update: vi.fn() } as never, root: v.root as never }).mount();
    await v.form.trigger("submit");
    expect(create).not.toHaveBeenCalled(); expect(v.notice.textContent).toContain("nombre");
  });

  it("disables duplicate submits and reports server errors", async () => {
    const v = view(); let reject!: (error: Error) => void;
    const pending = new Promise((_, r) => { reject = r; }); const create = vi.fn(() => pending);
    new ThemeEditorController({ api: { create, update: vi.fn() } as never, root: v.root as never }).mount();
    const first = v.form.trigger("submit"); await v.form.trigger("submit");
    expect(create).toHaveBeenCalledTimes(1); expect(v.submit.disabled).toBe(true);
    reject(new Error("No se pudo guardar")); await first;
    expect(v.notice.textContent).toBe("No se pudo guardar"); expect(v.submit.disabled).toBe(false);
  });

  it("mounts safely only once when page-load repeats", async () => {
    const v = view(); const create = vi.fn().mockResolvedValue({ reference: { id: "one" } });
    const controller = new ThemeEditorController({ api: { create, update: vi.fn() } as never, root: v.root as never });
    controller.mount(); controller.mount(); await v.form.trigger("submit");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("warns when a changed accent loses contrast with its inherited text", async () => {
    const v = view();
    const contrast = new FakeElement();
    v.root.one.set("[data-theme-contrast]", contrast);
    v.root.dataset.themeBases = JSON.stringify({ nanobook: {
      light: { "page-bg": "#ffffff", "surface-bg": "rgba(0, 0, 0, 0.03)", text: "#111111", "text-muted": "#333333", accent: "#111111", "accent-text": "#ffffff", link: "#111111", "focus-ring": "#111111", "selection-bg": "#111111", "selection-text": "#ffffff", border: "#333333" },
      dark: { "page-bg": "#111111", "surface-bg": "#222222", text: "#ffffff", "text-muted": "#dddddd", accent: "#ffffff", "accent-text": "#111111", link: "#ffffff", "focus-ring": "#ffffff", "selection-bg": "#ffffff", "selection-text": "#111111", border: "#dddddd" },
    } });
    new ThemeEditorController({ api: { create: vi.fn(), update: vi.fn() } as never, root: v.root as never }).mount();
    v.accent.value = "#eeeeee";
    await v.accent.trigger("input");
    expect(contrast.textContent).toContain("Texto sobre acento");
    expect(contrast.textContent).toContain("claro");
  });
  it("keeps inherited dependent swatches aligned after changing the base", async () => {
    const v = view();
    const link = new FakeElement();
    link.dataset.themeField = "light.link";
    link.dataset.themeOverride = "false";
    v.accent.dataset.themeOverride = "true";
    v.root.many.set("[data-theme-field]", [...v.root.many.get("[data-theme-field]")!, link]);
    v.root.one.set('[data-theme-field="light.accent"]', v.accent);
    v.root.one.set('[data-theme-field="light.link"]', link);
    v.root.dataset.themeBases = JSON.stringify({
      nanobook: { light: { accent: "#111111", link: "#111111", "page-bg": "#ffffff" }, dark: {} },
      classic: { light: { accent: "#000000", link: "#000000", "page-bg": "#ffffff" }, dark: {} },
    });
    new ThemeEditorController({ api: { create: vi.fn(), update: vi.fn() } as never, root: v.root as never }).mount();
    const base = v.root.one.get('[name="baseThemeId"]')!;
    base.value = "classic";
    await base.trigger("change");
    expect(link.value).toBe("#3159d8");
    expect(v.preview.style.values.get("--theme-light-link")).toBe("#3159d8");
  });
});
