import {
  cornerImage,
  densityValues,
  patternValues,
  shadowValue,
} from "../../shared/ThemePresets";

export type OfficialThemeId =
  | "classic"
  | "nanobook"
  | "herbario"
  | "plano"
  | "monocromo";

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

const monocromo: OfficialThemeDefinition = {
  id: "monocromo",
  light: {
    ...classic.light,
    "page-bg": "#f1f1ee",
    "surface-bg": "#fdfdfb",
    text: "#1b1b1a",
    "text-muted": "#585856",
    accent: "#20201f",
    "accent-text": "#ffffff",
    "surface-raised": "#ffffff",
    border: "#c6c6c2",
    "border-subtle": "#e0e0dc",
    "control-radius": "5px",
    "panel-radius": "5px",
    "content-gap": "1.5rem",
    "cover-radius": "3px 9px 9px 3px",
    "cover-spine-width": "9px",
    "decoration-shadow": shadowValue("offset"),
  },
  dark: {
    ...classic.dark,
    "page-bg": "#171716",
    "surface-bg": "#222220",
    text: "#f0f0ec",
    "text-muted": "#b8b8b2",
    accent: "#f0f0ec",
    "accent-text": "#1b1b1a",
    "surface-raised": "#2c2c2a",
    border: "#484844",
    "border-subtle": "#343432",
    "control-radius": "5px",
    "panel-radius": "5px",
    "content-gap": "1.5rem",
    "cover-radius": "3px 9px 9px 3px",
    "cover-spine-width": "9px",
    "decoration-shadow": shadowValue("offset"),
  },
};

const nanobook: OfficialThemeDefinition = {
  id: "nanobook",
  light: {
    "page-bg": "#f1eee5",
    "surface-bg": "#fcfaf5",
    text: "#262923",
    "text-muted": "#5e625a",
    accent: "#984b34",
    "accent-text": "#fffaf4",
    "status-error": "#a43d32",
    "status-warning": "#805b11",
    "status-success": "#29634c",
    "status-info": "#3c627a",
    border: "#d1cfc3",
    "border-subtle": "#e4e1d6",
    "font-body":
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    "font-heading":
      "'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif",
    "font-code": "ui-monospace, monospace",
    "font-scale": "1rem",
    "control-radius": "5px",
    "panel-radius": "12px",
    "content-gap": "2rem",
    "decoration-pattern-image": patternValues("texture", "coarse", "subtle")
      .image,
    "decoration-pattern-step": patternValues("texture", "regular", "subtle")
      .step,
    "decoration-pattern-contrast": patternValues("texture", "coarse", "subtle")
      .contrast,
    "cover-radius": "3px 9px 9px 3px",
    "cover-spine-width": "12px",
    "decoration-corner-image": "none",
    "decoration-shadow": shadowValue("offset"),
  },
  dark: {
    "page-bg": "#171916",
    "surface-bg": "#21241f",
    text: "#f0eee5",
    "text-muted": "#b8b7ad",
    accent: "#e4a080",
    "accent-text": "#2b1d16",
    "status-error": "#ff9185",
    "status-warning": "#eac47a",
    "status-success": "#88c7a5",
    "status-info": "#8cbddb",
    border: "#45483f",
    "border-subtle": "#32352f",
    "font-body":
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    "font-heading":
      "'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif",
    "font-code": "ui-monospace, monospace",
    "font-scale": "1rem",
    "control-radius": "5px",
    "panel-radius": "12px",
    "content-gap": "2rem",
    "decoration-pattern-image": patternValues("texture", "coarse", "subtle")
      .image,
    "decoration-pattern-step": patternValues("texture", "regular", "subtle")
      .step,
    "decoration-pattern-contrast": patternValues("texture", "coarse", "subtle")
      .contrast,
    "cover-radius": "3px 9px 9px 3px",
    "cover-spine-width": "12px",
    "decoration-corner-image": "none",
    "decoration-shadow": shadowValue("offset"),
  },
};

const herbario: OfficialThemeDefinition = {
  id: "herbario",
  light: {
    ...nanobook.light,
    "page-bg": "#eef1e8",
    "surface-bg": "#f8faf4",
    text: "#26332b",
    "text-muted": "#5e6d61",
    accent: "#3f694f",
    "accent-text": "#f7faf4",
    "status-success": "#28644a",
    border: "#cbd5c8",
    "border-subtle": "#dfe6dc",
    "font-heading": "'Iowan Old Style', 'Palatino Linotype', Georgia, serif",
    "control-radius": "4px",
    "panel-radius": "8px",
    "decoration-pattern-image": patternValues("texture", "fine", "subtle")
      .image,
    "decoration-pattern-step": patternValues("texture", "fine", "subtle").step,
    "decoration-pattern-contrast": patternValues("texture", "fine", "subtle")
      .contrast,
  },
  dark: {
    ...nanobook.dark,
    "page-bg": "#17211b",
    "surface-bg": "#202d24",
    text: "#e7eee6",
    "text-muted": "#b0c0b2",
    accent: "#a5c89f",
    "accent-text": "#1c2b20",
    "status-success": "#8fd0a5",
    border: "#405447",
    "border-subtle": "#2d3c32",
    "decoration-pattern-image": patternValues("texture", "fine", "subtle")
      .image,
    "decoration-pattern-step": patternValues("texture", "fine", "subtle").step,
    "decoration-pattern-contrast": patternValues("texture", "fine", "subtle")
      .contrast,
  },
};

const plano: OfficialThemeDefinition = {
  id: "plano",
  light: {
    ...classic.light,
    "page-bg": "#edf2f4",
    "surface-bg": "#f8fbfc",
    text: "#1d2b32",
    "text-muted": "#586c76",
    accent: "#17677b",
    "accent-text": "#f4fafb",
    "status-info": "#17677b",
    border: "#c7d5da",
    "border-subtle": "#dce6e9",
    "font-heading": "system-ui, sans-serif",
    "control-radius": "3px",
    "panel-radius": "5px",
    "decoration-pattern-image": patternValues("grid", "fine", "subtle").image,
    "decoration-pattern-step": patternValues("grid", "fine", "subtle").step,
    "decoration-pattern-contrast": patternValues("grid", "fine", "subtle")
      .contrast,
  },
  dark: {
    ...classic.dark,
    "page-bg": "#111c22",
    "surface-bg": "#1a2931",
    text: "#e2edf1",
    "text-muted": "#a9bdc6",
    accent: "#76c3d4",
    "accent-text": "#10252c",
    "status-info": "#83cee0",
    border: "#3a525e",
    "border-subtle": "#293d47",
    "font-heading": "system-ui, sans-serif",
    "control-radius": "3px",
    "panel-radius": "5px",
    "decoration-pattern-image": patternValues("grid", "fine", "subtle").image,
    "decoration-pattern-step": patternValues("grid", "fine", "subtle").step,
    "decoration-pattern-contrast": patternValues("grid", "fine", "subtle")
      .contrast,
  },
};

export class OfficialThemeCatalog {
  private readonly definitions = new Map<
    OfficialThemeId,
    OfficialThemeDefinition
  >([
    [classic.id, classic],
    [monocromo.id, monocromo],
    [nanobook.id, nanobook],
    [herbario.id, herbario],
    [plano.id, plano],
  ]);

  get(id: string): OfficialThemeDefinition {
    const definition = this.definitions.get(id as OfficialThemeId) ?? monocromo;
    const defaultDensity =
      definition.id === "classic" || definition.id === "monocromo"
        ? "comfortable"
        : "relaxed";
    const complete = (values: ThemeValues, mode: "light" | "dark") => ({
      ...values,
      link: values.accent,
      "focus-ring": values.accent,
      "selection-bg": values.accent,
      "selection-text": values["accent-text"],
      "surface-raised":
        values["surface-raised"] ??
        `color-mix(in srgb, var(--theme-${mode}-surface-bg) 92%, var(--theme-${mode}-text) 8%)`,
      "body-line-height": "1.75",
      "heading-scale": "1",
      "paragraph-gap": "1.25rem",
      "reading-measure": "100%",
      "space-inline": densityValues(defaultDensity).inline,
      "space-block": densityValues(defaultDensity).block,
      "space-section": densityValues(defaultDensity).section,
    });
    return {
      id: definition.id,
      light: complete(definition.light, "light"),
      dark: complete(definition.dark, "dark"),
    };
  }
}
