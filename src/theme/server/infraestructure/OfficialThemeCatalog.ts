import { densityValues, patternValues } from "../../shared/ThemePresets";

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
    "page-bg": "#f1f2f4",
    "surface-bg": "#ffffff",
    text: "#1c1d20",
    "text-muted": "#686b70",
    accent: "#101114",
    "accent-text": "#f1f2f4",
    "status-error": "#b42318",
    "status-warning": "#765000",
    "status-success": "#176b46",
    "status-info": "#205d87",
    border: "rgba(24, 28, 34, 0.14)",
    "border-subtle": "rgba(24, 28, 34, 0.07)",
    "font-body": "system-ui, sans-serif",
    "font-heading": "system-ui, sans-serif",
    "font-code": "ui-monospace, monospace",
    "font-scale": "1rem",
    "control-radius": "0px",
    "panel-radius": "0px",
    "content-gap": "1.5rem",
    "decoration-pattern-image": patternValues("grid", "fine", "subtle").image,
    "decoration-pattern-step": patternValues("grid", "coarse", "subtle").step,
    "decoration-pattern-contrast": patternValues("grid", "fine", "subtle").contrast,
    "cover-radius": "0px",
    "cover-spine-width": "0px",
    "decoration-corner-image": "none",
    "decoration-shadow": "none",
  },
  dark: {
    "page-bg": "#131517",
    "surface-bg": "#1b1e21",
    text: "#eceff1",
    "text-muted": "#a1a6ac",
    accent: "#ffffff",
    "accent-text": "#131517",
    "status-error": "#ff8b82",
    "status-warning": "#ffd166",
    "status-success": "#79d6a4",
    "status-info": "#8fc9ff",
    border: "rgba(236, 239, 241, 0.16)",
    "border-subtle": "rgba(236, 239, 241, 0.07)",
    "font-body": "system-ui, sans-serif",
    "font-heading": "system-ui, sans-serif",
    "font-code": "ui-monospace, monospace",
    "font-scale": "1rem",
    "control-radius": "0px",
    "panel-radius": "0px",
    "content-gap": "1.5rem",
    "decoration-pattern-image": patternValues("grid", "fine", "subtle").image,
    "decoration-pattern-step": patternValues("grid", "coarse", "subtle").step,
    "decoration-pattern-contrast": patternValues("grid", "fine", "subtle").contrast,
    "cover-radius": "0px",
    "cover-spine-width": "0px",
    "decoration-corner-image": "none",
    "decoration-shadow": "none",
  },
};

const nanobook: OfficialThemeDefinition = {
  id: "nanobook",
  light: {
    "page-bg": "#f4f2eb",
    "surface-bg": "#fbfaf6",
    text: "#252a27",
    "text-muted": "#656b64",
    accent: "#9b4f38",
    "accent-text": "#fffaf4",
    "status-error": "#a43d32",
    "status-warning": "#805b11",
    "status-success": "#29634c",
    "status-info": "#3c627a",
    border: "#d5d4c9",
    "border-subtle": "#e7e5db",
    "font-body": "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    "font-heading": "'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif",
    "font-code": "ui-monospace, monospace",
    "font-scale": "1rem",
    "control-radius": "5px",
    "panel-radius": "12px",
    "content-gap": "2rem",
    "decoration-pattern-image": patternValues("texture", "coarse", "subtle").image,
    "decoration-pattern-step": patternValues("texture", "regular", "subtle").step,
    "decoration-pattern-contrast": patternValues("texture", "coarse", "subtle").contrast,
    "cover-radius": "3px 9px 9px 3px",
    "cover-spine-width": "12px",
    "decoration-corner-image": "none",
    "decoration-shadow": "none",
  },
  dark: {
    "page-bg": "#171b19",
    "surface-bg": "#202522",
    text: "#ecebe4",
    "text-muted": "#b0b3aa",
    accent: "#e1a17f",
    "accent-text": "#281c16",
    "status-error": "#ff9185",
    "status-warning": "#eac47a",
    "status-success": "#88c7a5",
    "status-info": "#8cbddb",
    border: "#414840",
    "border-subtle": "#303732",
    "font-body": "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    "font-heading": "'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif",
    "font-code": "ui-monospace, monospace",
    "font-scale": "1rem",
    "control-radius": "5px",
    "panel-radius": "12px",
    "content-gap": "2rem",
    "decoration-pattern-image": patternValues("texture", "coarse", "subtle").image,
    "decoration-pattern-step": patternValues("texture", "regular", "subtle").step,
    "decoration-pattern-contrast": patternValues("texture", "coarse", "subtle").contrast,
    "cover-radius": "3px 9px 9px 3px",
    "cover-spine-width": "12px",
    "decoration-corner-image": "none",
    "decoration-shadow": "none",
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
      "reading-measure": "100%",
      "space-inline": densityValues(defaultDensity).inline,
      "space-block": densityValues(defaultDensity).block,
      "space-section": densityValues(defaultDensity).section,
    });
    return { id: definition.id, light: complete(definition.light, "light"), dark: complete(definition.dark, "dark") };
  }
}
