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
  const submit = new FakeElement(), notice = new FakeElement(), name = new FakeElement(), base = new FakeElement(), accent = new FakeElement();
  name.value = "Editorial"; base.value = "nanobook"; accent.value = "#3159d8"; accent.dataset.themeField = "light.accent";
  root.one.set("form", form); root.one.set("[data-theme-preview]", preview); root.one.set("[data-preview-mode-toggle]", toggle);
  root.one.set("[data-theme-submit]", submit); root.one.set("[data-theme-notice]", notice); root.one.set('[name="name"]', name); root.one.set('[name="baseThemeId"]', base);
  root.many.set("[data-theme-field]", [accent]);
  return { root, form, preview, toggle, submit, notice, name, accent };
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
});
