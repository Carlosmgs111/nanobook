import { describe, expect, it } from "vitest";
import { ThemeNavigationController } from "./ThemeNavigationController";

class FakeStyle {
  textContent = "";
  dataset: Record<string, string> = {};
}

function createDocument() {
  const style = new FakeStyle();
  return {
    style,
    querySelector: () => style,
    createElement: () => style,
    head: { append: () => undefined },
  } as any;
}

describe("ThemeNavigationController", () => {
  it("removes stale variables across custom, official and custom navigation", () => {
    const root = { dataset: {}, style: new FakeStyle(), ownerDocument: createDocument() } as any;
    const controller = new ThemeNavigationController(root);
    controller.apply({ theme: "nanobook", key: "custom:a", variables: { "--theme-light-accent": "#111111", "--theme-light-extra": "old" } });
    controller.apply({ theme: "classic", key: "official:classic", variables: { "--theme-light-accent": "#222222" } });
    expect(root.ownerDocument.style.textContent).not.toContain("--theme-light-extra:old");
    controller.apply({ theme: "nanobook", key: "custom:b", variables: { "--theme-light-accent": "#333333", "--theme-dark-accent": "#eeeeee" } });
    expect(root.ownerDocument.style.textContent).toContain("--theme-light-accent:#333333;");
    expect(root.ownerDocument.style.textContent).toContain("--theme-dark-accent:#eeeeee;");
    expect(root.dataset).toMatchObject({ theme: "nanobook", themeKey: "custom:b" });
  });
});
