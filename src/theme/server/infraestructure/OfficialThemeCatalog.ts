import { densityValues, hatchImage } from "../../shared/ThemePresets";

export type OfficialThemeId = "classic" | "nanobook";

type ThemeValues = Readonly<Record<string, string>>;

export interface OfficialThemeDefinition {
  id: OfficialThemeId;
  light: ThemeValues;
  dark: ThemeValues;
}

const classic: OfficialThemeDefinition = {
  id: "classic",
  light: {
    "page-bg": "#f5f5f7",
    "surface-bg": "rgba(0, 0, 0, 0.03)",
    text: "#1a1a1a",
    "text-muted": "#777777",
    accent: "#000000",
    "accent-text": "#f5f5f7",
    "status-error": "#dc2626",
    "status-warning": "#f59e0b",
    "status-success": "#10b981",
    "status-info": "#3b82f6",
    border: "rgba(0, 0, 0, 0.12)",
    "border-subtle": "rgba(0, 0, 0, 0.05)",
    "font-body": "system-ui, sans-serif",
    "font-heading": "system-ui, sans-serif",
    "font-code": "ui-monospace, monospace",
    "font-scale": "1rem",
    "control-radius": "0px",
    "panel-radius": "0px",
    "content-gap": "1.5rem",
    "page-pattern": "linear-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 0, 0.05) 1px, transparent 1px)",
    "cover-radius": "0px",
    "cover-spine-width": "0px",
    "decoration-corner-image": "none",
    "decoration-hatch-image": hatchImage("stripes"),
    "decoration-shadow": "none",
  },
  dark: {
    "page-bg": "#050505",
    "surface-bg": "rgba(255, 255, 255, 0.03)",
    text: "#e5e5e5",
    "text-muted": "#737373",
    accent: "#ffffff",
    "accent-text": "#050505",
    "status-error": "#f87171",
    "status-warning": "#f59e0b",
    "status-success": "#10b981",
    "status-info": "#3b82f6",
    border: "rgba(255, 255, 255, 0.12)",
    "border-subtle": "rgba(255, 255, 255, 0.05)",
    "font-body": "system-ui, sans-serif",
    "font-heading": "system-ui, sans-serif",
    "font-code": "ui-monospace, monospace",
    "font-scale": "1rem",
    "control-radius": "0px",
    "panel-radius": "0px",
    "content-gap": "1.5rem",
    "page-pattern": "linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)",
    "cover-radius": "0px",
    "cover-spine-width": "0px",
    "decoration-corner-image": "none",
    "decoration-hatch-image": hatchImage("stripes"),
    "decoration-shadow": "none",
  },
};

const nanobook: OfficialThemeDefinition = {
  id: "nanobook",
  light: {
    "page-bg": "#f7f5ef",
    "surface-bg": "#ffffff",
    text: "#171717",
    "text-muted": "#68655f",
    accent: "#111111",
    "accent-text": "#f7f5ef",
    "status-error": "#dc2626",
    "status-warning": "#f59e0b",
    "status-success": "#10b981",
    "status-info": "#3b82f6",
    border: "#d8d4ca",
    "border-subtle": "#ebe7de",
    "font-body": "Arial, Helvetica, sans-serif",
    "font-heading": "Arial, Helvetica, sans-serif",
    "font-code": "ui-monospace, monospace",
    "font-scale": "1rem",
    "control-radius": "5px",
    "panel-radius": "8px",
    "content-gap": "2rem",
    "page-pattern": "none",
    "cover-radius": "3px 9px 9px 3px",
    "cover-spine-width": "12px",
    "decoration-corner-image": "none",
    "decoration-hatch-image": hatchImage("texture"),
    "decoration-shadow": "12px 12px 0 var(--theme-border-subtle)",
  },
  dark: {
    "page-bg": "#121210",
    "surface-bg": "#1b1a17",
    text: "#f1efe8",
    "text-muted": "#aaa69c",
    accent: "#ffffff",
    "accent-text": "#121210",
    "status-error": "#f87171",
    "status-warning": "#f59e0b",
    "status-success": "#10b981",
    "status-info": "#3b82f6",
    border: "#393730",
    "border-subtle": "#282721",
    "font-body": "Arial, Helvetica, sans-serif",
    "font-heading": "Arial, Helvetica, sans-serif",
    "font-code": "ui-monospace, monospace",
    "font-scale": "1rem",
    "control-radius": "5px",
    "panel-radius": "8px",
    "content-gap": "2rem",
    "page-pattern": "none",
    "cover-radius": "3px 9px 9px 3px",
    "cover-spine-width": "12px",
    "decoration-corner-image": "none",
    "decoration-hatch-image": hatchImage("texture"),
    "decoration-shadow": "12px 12px 0 var(--theme-border-subtle)",
  },
};

export class OfficialThemeCatalog {
  private readonly definitions = new Map<OfficialThemeId, OfficialThemeDefinition>([
    [classic.id, classic],
    [nanobook.id, nanobook],
  ]);

  get(id: string): OfficialThemeDefinition {
    const definition = this.definitions.get(id as OfficialThemeId) ?? classic;
    const defaultDensity = definition.id === "classic" ? "comfortable" : "relaxed";
    const complete = (values: ThemeValues, mode: "light" | "dark") => ({
      ...values,
      link: values.accent,
      "focus-ring": values.accent,
      "selection-bg": values.accent,
      "selection-text": values["accent-text"],
      "surface-raised": `color-mix(in srgb, var(--theme-${mode}-surface-bg) 92%, var(--theme-${mode}-text) 8%)`,
      "body-line-height": "1.75",
      "heading-scale": "1",
      "paragraph-gap": "1.25rem",
      "reading-measure": "72ch",
      "space-inline": densityValues(defaultDensity).inline,
      "space-block": densityValues(defaultDensity).block,
      "space-section": densityValues(defaultDensity).section,
    });
    return { id: definition.id, light: complete(definition.light, "light"), dark: complete(definition.dark, "dark") };
  }
}
