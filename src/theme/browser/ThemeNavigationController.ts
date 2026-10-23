import { serializeThemeCss } from "../shared/ThemeCss";

export interface ThemeNavigationState {
  theme: string;
  key: string;
  variables: Record<string, string>;
  colorMode?: "light" | "dark";
}

export class ThemeNavigationController {
  constructor(private readonly root?: HTMLElement) {}

  apply(state: ThemeNavigationState) {
    const root = this.root ?? globalThis.document.documentElement;
    const document = root.ownerDocument ?? globalThis.document;
    let style = document.querySelector<HTMLStyleElement>("style[data-nanobook-theme]");
    if (!style) {
      style = document.createElement("style");
      style.dataset.nanobookTheme = "";
      document.head.append(style);
    }
    style.textContent = serializeThemeCss(state.variables);
    root.dataset.theme = state.theme;
    root.dataset.themeKey = state.key;
    if (state.colorMode) root.dataset.colorMode = state.colorMode;
  }

  syncFromDocument() {
    const marker = document.querySelector<HTMLMetaElement>('meta[data-theme-state]');
    if (!marker) return;
    try {
      this.apply({
        theme: marker.dataset.theme ?? "monocromo",
        key: marker.dataset.themeKey ?? "official:monocromo",
        colorMode: marker.dataset.colorMode as ThemeNavigationState["colorMode"],
        variables: JSON.parse(marker.dataset.themeVariables ?? "{}"),
      });
    } catch { /* SSR root already contains a safe complete theme. */ }
  }
}
