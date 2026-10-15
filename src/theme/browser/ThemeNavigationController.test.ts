import { describe, expect, it } from "vitest";
import { ThemeNavigationController } from "./ThemeNavigationController";

class FakeStyle {
  values = new Map<string, string>();
  setProperty(name: string, value: string) { this.values.set(name, value); }
  removeProperty(name: string) { this.values.delete(name); }
  [Symbol.iterator]() { return this.values.keys(); }
}

describe("ThemeNavigationController", () => {
  it("removes stale variables across custom, official and custom navigation", () => {
    const root = { dataset: {}, style: new FakeStyle() } as any;
    const controller = new ThemeNavigationController(root);
    controller.apply({ theme: "nanobook", key: "custom:a", variables: { "--theme-light-accent": "#111111", "--theme-light-extra": "old" } });
    controller.apply({ theme: "classic", key: "official:classic", variables: { "--theme-light-accent": "#222222" } });
    expect(root.style.values.has("--theme-light-extra")).toBe(false);
    controller.apply({ theme: "nanobook", key: "custom:b", variables: { "--theme-light-accent": "#333333", "--theme-dark-accent": "#eeeeee" } });
    expect(Object.fromEntries(root.style.values)).toEqual({ "--theme-light-accent": "#333333", "--theme-dark-accent": "#eeeeee" });
    expect(root.dataset).toMatchObject({ theme: "nanobook", themeKey: "custom:b" });
  });
});
