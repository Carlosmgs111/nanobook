import type { HttpThemeApi, ThemeTokensDto } from "./HttpThemeApi";

interface Options { api: Pick<HttpThemeApi, "create" | "update">; root?: HTMLElement; }

export class ThemeEditorController {
  private root?: HTMLElement;
  private submitting = false;
  constructor(private readonly options: Options) { this.root = options.root; }

  mount(): void {
    const root = this.getRoot();
    if (!root || root.dataset.themeEditorReady === "true") return;
    root.dataset.themeEditorReady = "true";
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-theme-field]").forEach((control) => {
      const update = () => this.updatePreview(control);
      control.addEventListener("input", update);
      control.addEventListener("change", update);
      update();
    });
    const preview = root.querySelector<HTMLElement>("[data-theme-preview]");
    if (preview) preview.dataset.previewMode = "light";
    root.querySelector<HTMLElement>("[data-preview-mode-toggle]")?.addEventListener("click", () => {
      if (preview) preview.dataset.previewMode = preview.dataset.previewMode === "dark" ? "light" : "dark";
    });
    root.querySelector<HTMLFormElement>("form")?.addEventListener("submit", (event) => this.submit(event));
  }

  private getRoot() {
    if (!this.root) this.root = document.querySelectorAll<HTMLElement>("[data-theme-editor]")[0];
    return this.root;
  }

  private updatePreview(control: HTMLInputElement | HTMLSelectElement) {
    const preview = this.getRoot()?.querySelector<HTMLElement>("[data-theme-preview]");
    const path = control.dataset.themeField;
    if (!preview || !path) return;
    const [group, token] = path.split(".");
    if ((group === "light" || group === "dark") && token) {
      const cssName = ({ pageBackground: "page-bg", surfaceBackground: "surface-bg", text: "text", textMuted: "text-muted", accent: "accent", border: "border" } as Record<string, string>)[token];
      if (cssName) preview.style.setProperty(`--theme-${group}-${cssName}`, control.value);
      return;
    }
    for (const [name, value] of Object.entries(presetVariables(path, control.value))) preview.style.setProperty(name, value);
  }

  private async submit(event: Event) {
    event.preventDefault();
    if (this.submitting) return;
    const root = this.getRoot();
    if (!root) return;
    const name = root.querySelector<HTMLInputElement>('[name="name"]')?.value.trim() ?? "";
    if (!name) { this.notice("Escribe un nombre para el tema."); return; }
    const baseThemeId = root.querySelector<HTMLSelectElement>('[name="baseThemeId"]')?.value === "classic" ? "classic" : "nanobook";
    const tokens = this.readTokens(root);
    this.submitting = true;
    this.setDisabled(true);
    this.notice("");
    try {
      const result = root.dataset.themeId
        ? await this.options.api.update(root.dataset.themeId, { name, tokens })
        : await this.options.api.create({ name, baseThemeId, tokens });
      root.dataset.themeId = result.reference.id;
      this.notice("Tema guardado.");
    } catch (error) {
      this.notice(error instanceof Error ? error.message : "No fue posible guardar el tema");
    } finally {
      this.submitting = false;
      this.setDisabled(false);
    }
  }

  private readTokens(root: HTMLElement): ThemeTokensDto {
    const tokens: any = {};
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-theme-field]").forEach((control) => {
      const [group, token] = (control.dataset.themeField ?? "").split(".");
      if (!group || !token || !control.value) return;
      tokens[group] ??= {};
      tokens[group][token] = control.value;
    });
    return tokens;
  }

  private notice(message: string) { const node = this.getRoot()?.querySelector<HTMLElement>("[data-theme-notice]"); if (node) node.textContent = message; }
  private setDisabled(value: boolean) { const button = this.getRoot()?.querySelector<HTMLButtonElement>("[data-theme-submit]"); if (button) button.disabled = value; }
}

function presetVariables(path: string, value: string): Record<string, string> {
  if (path === "typography.family") {
    const font = { "system-sans": "system-ui, sans-serif", "editorial-serif": 'Georgia, "Times New Roman", serif', mono: "ui-monospace, monospace" }[value];
    return font ? { "--theme-light-font-body": font, "--theme-light-font-heading": font, "--theme-dark-font-body": font, "--theme-dark-font-heading": font } : {};
  }
  if (path === "shape.radius") {
    const radius = { square: "0px", soft: "5px", rounded: "14px" }[value];
    return radius ? { "--theme-light-control-radius": radius, "--theme-light-panel-radius": radius, "--theme-dark-control-radius": radius, "--theme-dark-panel-radius": radius } : {};
  }
  if (path === "layout.density") {
    const gap = { compact: "1rem", comfortable: "1.5rem", relaxed: "2rem" }[value];
    return gap ? { "--theme-light-content-gap": gap, "--theme-dark-content-gap": gap } : {};
  }
  if (path === "decoration.pattern") {
    const patterns: Record<string, string> = { none: "none", grid: "linear-gradient(currentColor 1px, transparent 1px)", hatch: "repeating-linear-gradient(135deg, currentColor 0 1px, transparent 1px 10px)" };
    return patterns[value] ? { "--theme-light-page-pattern": patterns[value], "--theme-dark-page-pattern": patterns[value] } : {};
  }
  return {};
}
