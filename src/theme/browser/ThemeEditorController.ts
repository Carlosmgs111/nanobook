import type { HttpThemeApi, ThemeTokensDto } from "./HttpThemeApi";
import { cornerImage, coverValues, patternImage, patternStep, patternContrast, shadowValue, rhythmValues, readingMeasureValue, densityValues, type ThemePattern, type ThemePatternScale, type ThemePatternContrast } from "../shared/ThemePresets";
import { colorInputValue, raisedColorInputValue } from "../shared/ColorPreview";
import { analyzeThemeContrast } from "../shared/ThemeContrast";

interface Options {
  api: Pick<HttpThemeApi, "create" | "update">;
  root?: HTMLElement;
}

export class ThemeEditorController {
  private root?: HTMLElement;
  private submitting = false;
  constructor(private readonly options: Options) {
    this.root = options.root;
  }

  mount(): void {
    const root = this.getRoot();
    if (!root || root.dataset.themeEditorReady === "true") return;
    root.dataset.themeEditorReady = "true";
    root
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        "[data-theme-field]"
      )
      .forEach((control) => {
        const update = () => {
          control.dataset.themeOverride = "true";
          if (control.dataset.themeField === "typography.family") {
            const heading = root.querySelector<HTMLSelectElement>('[data-theme-field="typography.heading"]');
            if (heading?.dataset.themeOverride === "false") heading.value = control.value;
          }
          this.updatePreview(control);
        };
        control.addEventListener("input", update);
        control.addEventListener("change", update);
        if (control.dataset.themeOverride !== "false") this.updatePreview(control);
      });
    root.querySelector<HTMLSelectElement>('[name="baseThemeId"]')
      ?.addEventListener("change", () => this.updateBasePreview());
    root.querySelector<HTMLElement>("[data-theme-reset]")
      ?.addEventListener("click", () => {
        root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-theme-field]")
          .forEach((control) => { control.dataset.themeOverride = "false"; });
        this.updateBasePreview();
        this.notice("Valores heredados del tema base restaurados. Guarda para aplicar el cambio.");
      });
    const preview = root.querySelector<HTMLElement>("[data-theme-preview]");
    if (preview) preview.dataset.previewMode = "light";
    root
      .querySelector<HTMLElement>("[data-preview-mode-toggle]")
      ?.addEventListener("click", () => {
        if (preview)
          preview.dataset.previewMode =
            preview.dataset.previewMode === "dark" ? "light" : "dark";
      });
    root
      .querySelector<HTMLFormElement>("form")
      ?.addEventListener("submit", (event) => this.submit(event));
    this.updateContrast();
  }

  private getRoot() {
    if (!this.root)
      this.root = document.querySelectorAll<HTMLElement>(
        "[data-theme-editor]"
      )[0];
    return this.root;
  }

  private updatePreview(control: HTMLInputElement | HTMLSelectElement) {
    const preview = this.getRoot()?.querySelector<HTMLElement>(
      "[data-theme-preview]"
    );
    const path = control.dataset.themeField;
    if (!preview || !path) return;
    const [group, token] = path.split(".");
    if ((group === "light" || group === "dark") && token) {
      const cssName = (
        {
          pageBackground: "page-bg",
          surfaceBackground: "surface-bg",
          text: "text",
          textMuted: "text-muted",
          accent: "accent",
          border: "border",
          borderSubtle: "border-subtle",
          accentText: "accent-text",
          statusError: "status-error",
          statusWarning: "status-warning",
          statusSuccess: "status-success",
          statusInfo: "status-info",
          link: "link",
          focusRing: "focus-ring",
          selectionBg: "selection-bg",
          selectionText: "selection-text",
          surfaceRaised: "surface-raised",
        } as Record<string, string>
      )[token];
      if (cssName)
        preview.style.setProperty(`--theme-${group}-${cssName}`, control.value);
      const dependent = token === "accent"
        ? ["link", "focusRing", "selectionBg"]
        : token === "accentText" ? ["selectionText"] : [];
      for (const name of dependent) {
        const field = this.getRoot()?.querySelector<HTMLInputElement>(`[data-theme-field="${group}.${name}"]`);
        if (field?.dataset.themeOverride === "false") {
          const cssName = name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
          field.value = control.value;
          preview.style.setProperty(`--theme-${group}-${cssName}`, control.value);
        }
      }
      this.updateContrast();
      return;
    }
    for (const [name, value] of Object.entries(
      presetVariables(path, control.value)
    ))
      preview.style.setProperty(name, value);
  }

  private updateBasePreview() {
    const root = this.getRoot();
    const preview = root?.querySelector<HTMLElement>("[data-theme-preview]");
    const selected = root?.querySelector<HTMLSelectElement>('[name="baseThemeId"]')?.value;
    if (!root || !preview || !selected || !root.dataset.themeBases) return;
    const bases = JSON.parse(root.dataset.themeBases) as Record<string, { light: Record<string, string>; dark: Record<string, string> }>;
    const base = bases[selected];
    if (!base) return;
    preview.style.cssText = "";
    for (const mode of ["light", "dark"] as const) {
      for (const [name, value] of Object.entries(base[mode])) {
        preview.style.setProperty(`--theme-${mode}-${name}`, value);
      }
    }
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-theme-field]")
      .forEach((control) => {
        if (control.dataset.themeOverride === "false") {
          const [mode, name] = (control.dataset.themeField ?? "").split(".");
          const defaults: Record<string, Record<string, string>> = {
            classic: { "typography.family": "system-sans", "typography.heading": "system-sans", "typography.code": "mono", "typography.scale": "normal", "typography.rhythm": "balanced", "shape.radius": "square", "shape.cover": "square", "layout.density": "comfortable", "layout.readingMeasure": "full", "decoration.pattern": "grid", "decoration.patternScale": "coarse", "decoration.patternContrast": "subtle", "decoration.corners": "none", "decoration.shadow": "flat" },
            nanobook: { "typography.family": "system-sans", "typography.heading": "editorial-serif", "typography.code": "mono", "typography.scale": "normal", "typography.rhythm": "balanced", "shape.radius": "soft", "shape.cover": "book", "layout.density": "relaxed", "layout.readingMeasure": "full", "decoration.pattern": "texture", "decoration.patternScale": "regular", "decoration.patternContrast": "subtle", "decoration.corners": "none", "decoration.shadow": "flat" },
            herbario: { "typography.family": "system-sans", "typography.heading": "editorial-serif", "typography.code": "mono", "typography.scale": "normal", "typography.rhythm": "balanced", "shape.radius": "soft", "shape.cover": "book", "layout.density": "relaxed", "layout.readingMeasure": "full", "decoration.pattern": "texture", "decoration.patternScale": "fine", "decoration.patternContrast": "subtle", "decoration.corners": "none", "decoration.shadow": "flat" },
            plano: { "typography.family": "system-sans", "typography.heading": "system-sans", "typography.code": "mono", "typography.scale": "normal", "typography.rhythm": "balanced", "shape.radius": "square", "shape.cover": "square", "layout.density": "comfortable", "layout.readingMeasure": "full", "decoration.pattern": "grid", "decoration.patternScale": "fine", "decoration.patternContrast": "subtle", "decoration.corners": "none", "decoration.shadow": "flat" },
            monocromo: { "typography.family": "system-sans", "typography.heading": "editorial-serif", "typography.code": "mono", "typography.scale": "normal", "typography.rhythm": "balanced", "shape.radius": "soft", "shape.cover": "book", "layout.density": "comfortable", "layout.readingMeasure": "full", "decoration.pattern": "texture", "decoration.patternScale": "fine", "decoration.patternContrast": "subtle", "decoration.corners": "line", "decoration.shadow": "offset" },
          };
          const selectedDefaults = defaults[selected] ?? defaults.monocromo;
          if (selectedDefaults[control.dataset.themeField ?? ""]) control.value = selectedDefaults[control.dataset.themeField ?? ""];
          if (mode === "light" || mode === "dark") {
            const cssName = ({ pageBackground: "page-bg", surfaceBackground: "surface-bg" } as Record<string, string>)[name] ?? name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
            const color = base[mode][cssName];
            control.value = name === "surfaceRaised"
              ? raisedColorInputValue(base[mode]["surface-bg"], base[mode].text, base[mode]["page-bg"])
              : colorInputValue(color, base[mode]["page-bg"]);
          }
        } else this.updatePreview(control);
      });
    const family = root.querySelector<HTMLSelectElement>('[data-theme-field="typography.family"]');
    const heading = root.querySelector<HTMLSelectElement>('[data-theme-field="typography.heading"]');
    if (family?.dataset.themeOverride === "true" && heading?.dataset.themeOverride === "false") {
      heading.value = family.value;
    }
    for (const mode of ["light", "dark"] as const) {
      for (const name of ["accent", "accentText"] as const) {
        const control = root.querySelector<HTMLInputElement>(`[data-theme-field="${mode}.${name}"]`);
        if (control?.dataset.themeOverride === "true") this.updatePreview(control);
      }
    }
    this.updateContrast();
  }

  private updateContrast(): void {
    const root = this.getRoot();
    const node = root?.querySelector<HTMLElement>("[data-theme-contrast]");
    const selected = root?.querySelector<HTMLSelectElement>('[name="baseThemeId"]')?.value;
    if (!root || !node || !selected || !root.dataset.themeBases) return;
    const bases = JSON.parse(root.dataset.themeBases) as Record<string, {
      light: Record<string, string>; dark: Record<string, string>;
    }>;
    const base = bases[selected];
    if (!base) return;
    const palettes = { light: { ...base.light }, dark: { ...base.dark } };
    root.querySelectorAll<HTMLInputElement>("[data-theme-field]").forEach((control) => {
      if (control.dataset.themeOverride !== "true") return;
      const [mode, token] = (control.dataset.themeField ?? "").split(".");
      if (mode !== "light" && mode !== "dark") return;
      const cssName = ({ pageBackground: "page-bg", surfaceBackground: "surface-bg" } as Record<string, string>)[token]
        ?? token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      palettes[mode][cssName] = control.value;
    });
    for (const mode of ["light", "dark"] as const) {
      const palette = palettes[mode];
      const isOverridden = (name: string) => root.querySelector<HTMLInputElement>(`[data-theme-field="${mode}.${name}"]`)?.dataset.themeOverride === "true";
      if (!isOverridden("link")) palette.link = palette.accent;
      if (!isOverridden("focusRing")) palette["focus-ring"] = palette.accent;
      if (!isOverridden("selectionBg")) palette["selection-bg"] = palette.accent;
      if (!isOverridden("selectionText")) palette["selection-text"] = palette["accent-text"];
    }
    const labels: Record<string, string> = {
      "text/page-bg": "Texto sobre página",
      "text/surface-bg": "Texto sobre superficie",
      "text-muted/page-bg": "Texto secundario sobre página",
      "text-muted/surface-bg": "Texto secundario sobre superficie",
      "link/page-bg": "Enlace sobre página",
      "link/surface-bg": "Enlace sobre superficie",
      "accent-text/accent": "Texto sobre acento",
      "selection-text/selection-bg": "Texto seleccionado",
      "focus-ring/page-bg": "Foco sobre página",
      "focus-ring/surface-bg": "Foco sobre superficie",
      "border/surface-bg": "Borde sobre superficie",
      "status-error/surface-bg": "Error sobre superficie",
      "status-warning/surface-bg": "Aviso sobre superficie",
      "status-success/surface-bg": "Éxito sobre superficie",
      "status-info/surface-bg": "Información sobre superficie",
    };
    const issues = analyzeThemeContrast(palettes);
    node.textContent = issues.length === 0
      ? "Contraste suficiente en las combinaciones comprobadas."
      : issues.map((issue) => `${issue.mode === "light" ? "Modo claro" : "Modo oscuro"}: ${labels[issue.pair] ?? issue.pair} — ${issue.status === "unverifiable" ? "no verificable" : `${issue.ratio.toFixed(2)}:1; mínimo ${issue.minimum}:1`}.`).join("\n");
  }

  private async submit(event: Event) {
    event.preventDefault();
    if (this.submitting) return;
    const root = this.getRoot();
    if (!root) return;
    const name =
      root.querySelector<HTMLInputElement>('[name="name"]')?.value.trim() ?? "";
    if (!name) {
      this.notice("Escribe un nombre para el tema.");
      return;
    }
    const baseThemeId = (root.querySelector<HTMLSelectElement>('[name="baseThemeId"]')?.value ?? "monocromo") as import("../server/infraestructure/OfficialThemeCatalog").OfficialThemeId;
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
      this.notice(
        error instanceof Error
          ? error.message
          : "No fue posible guardar el tema"
      );
    } finally {
      this.submitting = false;
      this.setDisabled(false);
    }
  }

  private readTokens(root: HTMLElement): ThemeTokensDto {
    const tokens: any = {};
    root
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>(
        "[data-theme-field]"
      )
      .forEach((control) => {
        const [group, token] = (control.dataset.themeField ?? "").split(".");
        if (!group || !token || !control.value || control.dataset.themeOverride === "false") return;
        tokens[group] ??= {};
        tokens[group][token] = control.value;
      });
    return tokens;
  }

  private notice(message: string) {
    const node = this.getRoot()?.querySelector<HTMLElement>(
      "[data-theme-notice]"
    );
    if (node) node.textContent = message;
  }
  private setDisabled(value: boolean) {
    const button = this.getRoot()?.querySelector<HTMLButtonElement>(
      "[data-theme-submit]"
    );
    if (button) button.disabled = value;
  }
}

function presetVariables(path: string, value: string): Record<string, string> {
  if (["typography.family", "typography.heading", "typography.code"].includes(path)) {
    const font = {
      "system-sans": "system-ui, sans-serif",
      "editorial-serif": 'Georgia, "Times New Roman", serif',
      mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    }[value];
    if (!font) return {};
    const roles = path === "typography.family" ? ["body", "heading"] : [path.split(".")[1]];
    return Object.fromEntries(roles.flatMap((role) => [
      [`--theme-light-font-${role}`, font], [`--theme-dark-font-${role}`, font],
    ]));
  }
  if (path === "typography.scale") {
    const size = { small: "0.875rem", normal: "1rem", large: "1.125rem" }[value];
    return size ? { "--theme-light-font-scale": size, "--theme-dark-font-scale": size } : {};
  }
  if (path === "typography.rhythm" && ["compact", "balanced", "airy"].includes(value)) {
    const rhythm = rhythmValues(value as "compact" | "balanced" | "airy");
    return Object.fromEntries((["light", "dark"] as const).flatMap((mode) => [
      [`--theme-${mode}-body-line-height`, rhythm.lineHeight],
      [`--theme-${mode}-heading-scale`, rhythm.headingScale],
      [`--theme-${mode}-paragraph-gap`, rhythm.paragraphGap],
    ]));
  }
  if (path === "layout.readingMeasure" && ["narrow", "standard", "wide", "full"].includes(value)) {
    const measure = readingMeasureValue(value as "narrow" | "standard" | "wide" | "full");
    return { "--theme-light-reading-measure": measure, "--theme-dark-reading-measure": measure };
  }
  if (path === "shape.radius") {
    const radius = { square: "0px", soft: "5px", rounded: "14px" }[value];
    return radius
      ? {
          "--theme-light-control-radius": radius,
          "--theme-light-panel-radius": radius,
          "--theme-dark-control-radius": radius,
          "--theme-dark-panel-radius": radius,
        }
      : {};
  }
  if (path === "shape.cover" && ["book", "square", "rounded"].includes(value)) {
    const cover = coverValues(value as "book" | "square" | "rounded");
    return {
      "--theme-light-cover-radius": cover.radius,
      "--theme-dark-cover-radius": cover.radius,
      "--theme-light-cover-spine-width": cover.spine,
      "--theme-dark-cover-spine-width": cover.spine,
    };
  }
  if (path === "layout.density") {
    if (!["compact", "comfortable", "relaxed"].includes(value)) return {};
    const density = densityValues(value as "compact" | "comfortable" | "relaxed");
    return Object.fromEntries((["light", "dark"] as const).flatMap((mode) => [
      [`--theme-${mode}-content-gap`, density.contentGap],
      [`--theme-${mode}-space-inline`, density.inline],
      [`--theme-${mode}-space-block`, density.block],
      [`--theme-${mode}-space-section`, density.section],
    ]));
  }
  if (path === "decoration.pattern") {
    return ["none", "grid", "texture", "stripes", "hatch"].includes(value)
      ? {
          "--theme-light-decoration-pattern-image": patternImage(value as ThemePattern),
          "--theme-dark-decoration-pattern-image": patternImage(value as ThemePattern),
        }
      : {};
  }
  if (path === "decoration.patternScale") {
    return ["fine", "regular", "coarse"].includes(value)
      ? {
          "--theme-light-decoration-pattern-step": patternStep(value as ThemePatternScale),
          "--theme-dark-decoration-pattern-step": patternStep(value as ThemePatternScale),
        }
      : {};
  }
  if (path === "decoration.patternContrast") {
    return ["subtle", "balanced", "strong"].includes(value)
      ? {
          "--theme-light-decoration-pattern-contrast": patternContrast(value as ThemePatternContrast),
          "--theme-dark-decoration-pattern-contrast": patternContrast(value as ThemePatternContrast),
        }
      : {};
  }
  if (path === "decoration.corners" && ["none", "cross", "line"].includes(value)) {
    const image = cornerImage(value as "none" | "cross" | "line");
    return {
      "--theme-light-decoration-corner-image": image,
      "--theme-dark-decoration-corner-image": image,
    };
  }
  if (path === "decoration.shadow" && ["flat", "offset", "soft"].includes(value)) {
    const shadow = shadowValue(value as "flat" | "offset" | "soft");
    return {
      "--theme-light-decoration-shadow": shadow,
      "--theme-dark-decoration-shadow": shadow,
    };
  }
  return {};
}
