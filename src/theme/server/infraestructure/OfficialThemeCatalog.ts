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
    border: "rgba(0, 0, 0, 0.12)",
    "border-subtle": "rgba(0, 0, 0, 0.05)",
    "font-body": "system-ui, sans-serif",
    "font-heading": "system-ui, sans-serif",
    "font-code": "ui-monospace, monospace",
    "control-radius": "0px",
    "panel-radius": "0px",
    "content-gap": "1.5rem",
    "page-pattern": "linear-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 1px)",
  },
  dark: {
    "page-bg": "#050505",
    "surface-bg": "rgba(255, 255, 255, 0.03)",
    text: "#e5e5e5",
    "text-muted": "#737373",
    accent: "#ffffff",
    border: "rgba(255, 255, 255, 0.12)",
    "border-subtle": "rgba(255, 255, 255, 0.05)",
    "font-body": "system-ui, sans-serif",
    "font-heading": "system-ui, sans-serif",
    "font-code": "ui-monospace, monospace",
    "control-radius": "0px",
    "panel-radius": "0px",
    "content-gap": "1.5rem",
    "page-pattern": "linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px)",
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
    border: "#d8d4ca",
    "border-subtle": "#ebe7de",
    "font-body": "Arial, Helvetica, sans-serif",
    "font-heading": "Arial, Helvetica, sans-serif",
    "font-code": "ui-monospace, monospace",
    "control-radius": "5px",
    "panel-radius": "8px",
    "content-gap": "2rem",
    "page-pattern": "none",
  },
  dark: {
    "page-bg": "#121210",
    "surface-bg": "#1b1a17",
    text: "#f1efe8",
    "text-muted": "#aaa69c",
    accent: "#ffffff",
    border: "#393730",
    "border-subtle": "#282721",
    "font-body": "Arial, Helvetica, sans-serif",
    "font-heading": "Arial, Helvetica, sans-serif",
    "font-code": "ui-monospace, monospace",
    "control-radius": "5px",
    "panel-radius": "8px",
    "content-gap": "2rem",
    "page-pattern": "none",
  },
};

export class OfficialThemeCatalog {
  private readonly definitions = new Map<OfficialThemeId, OfficialThemeDefinition>([
    [classic.id, classic],
    [nanobook.id, nanobook],
  ]);

  get(id: string): OfficialThemeDefinition {
    return this.definitions.get(id as OfficialThemeId) ?? classic;
  }
}
