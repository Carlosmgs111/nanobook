export interface ThemeNavigationState {
  theme: string;
  key: string;
  variables: Record<string, string>;
  colorMode?: "light" | "dark" | "system";
}

export class ThemeNavigationController {
  constructor(private readonly root: HTMLElement = document.documentElement) {}

  apply(state: ThemeNavigationState) {
    for (const name of Array.from(this.root.style as unknown as Iterable<string>)) {
      if (name.startsWith("--theme-light-") || name.startsWith("--theme-dark-")) this.root.style.removeProperty(name);
    }
    for (const [name, value] of Object.entries(state.variables)) this.root.style.setProperty(name, value);
    this.root.dataset.theme = state.theme;
    this.root.dataset.themeKey = state.key;
    if (state.colorMode) this.root.dataset.colorMode = state.colorMode;
  }

  syncFromDocument() {
    const marker = document.querySelector<HTMLMetaElement>('meta[data-theme-state]');
    if (!marker) return;
    try {
      this.apply({
        theme: marker.dataset.theme ?? "classic",
        key: marker.dataset.themeKey ?? "official:classic",
        colorMode: marker.dataset.colorMode as ThemeNavigationState["colorMode"],
        variables: JSON.parse(marker.dataset.themeVariables ?? "{}"),
      });
    } catch { /* SSR root already contains a safe complete theme. */ }
  }
}
