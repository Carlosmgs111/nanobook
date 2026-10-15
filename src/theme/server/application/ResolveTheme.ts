import {
  OfficialThemeCatalog,
  type OfficialThemeId,
} from "../infraestructure/OfficialThemeCatalog";
import type { ThemeTokens } from "../domain/ThemeTokens";
import type { ThemeRepository } from "../domain/ports/ThemeRepository";
import type { ThemeReference } from "../../../shared/theme/ThemeReference";
export type { ThemeReference } from "../../../shared/theme/ThemeReference";

export interface AppliedTheme {
  key: string;
  baseId: OfficialThemeId;
  lightVariables: Readonly<Record<`--theme-light-${string}`, string>>;
  darkVariables: Readonly<Record<`--theme-dark-${string}`, string>>;
}

export class ResolveTheme {
  constructor(
    private readonly catalog: OfficialThemeCatalog,
    private readonly repository: ThemeRepository,
  ) {}

  async execute(reference: ThemeReference, _request?: Request): Promise<AppliedTheme> {
    if (reference.kind === "custom") {
      const found = await this.repository.findById(reference.id);
      if (found.isSuccess && found.getValue()) {
        const custom = found.getValue()!;
        const definition = this.catalog.get(custom.getBaseThemeId());
        const values = overlayTokens(definition.light, definition.dark, custom.getTokens());
        return {
          key: `custom:${custom.getId()}`,
          baseId: definition.id,
          lightVariables: prefix(values.light, "light"),
          darkVariables: prefix(values.dark, "dark"),
        };
      }
    }
    const definition = this.catalog.get(reference.id);
    return {
      key: `official:${definition.id}`,
      baseId: definition.id,
      lightVariables: prefix(definition.light, "light"),
      darkVariables: prefix(definition.dark, "dark"),
    };
  }
}

const COLOR_NAMES = {
  pageBg: "page-bg", surfaceBg: "surface-bg", text: "text", textMuted: "text-muted",
  accent: "accent", border: "border", borderSubtle: "border-subtle",
} as const;

function overlayTokens(
  baseLight: Readonly<Record<string, string>>,
  baseDark: Readonly<Record<string, string>>,
  tokens: ThemeTokens,
) {
  const light = { ...baseLight };
  const dark = { ...baseDark };
  for (const [mode, target] of [["light", light], ["dark", dark]] as const) {
    for (const [name, value] of Object.entries(tokens[mode] ?? {})) {
      target[COLOR_NAMES[name as keyof typeof COLOR_NAMES]] = value;
    }
  }

  const font = {
    "system-sans": "system-ui, sans-serif",
    "editorial-serif": 'Georgia, "Times New Roman", serif',
    mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  }[tokens.typography?.family ?? "system-sans"];
  if (tokens.typography) for (const target of [light, dark]) {
    target["font-body"] = font;
    target["font-heading"] = font;
  }

  const radius = { square: "0px", soft: "5px", rounded: "14px" }[tokens.shape?.radius ?? "square"];
  if (tokens.shape) for (const target of [light, dark]) {
    target["control-radius"] = radius;
    target["panel-radius"] = radius;
  }

  const gap = { compact: "1rem", comfortable: "1.5rem", relaxed: "2rem" }[tokens.layout?.density ?? "comfortable"];
  if (tokens.layout) for (const target of [light, dark]) target["content-gap"] = gap;

  if (tokens.decoration) {
    const patterns = patternValues(tokens.decoration.pattern);
    light["page-pattern"] = patterns.light;
    dark["page-pattern"] = patterns.dark;
  }
  return { light, dark };
}

function patternValues(pattern: NonNullable<ThemeTokens["decoration"]>["pattern"]) {
  if (pattern === "none") return { light: "none", dark: "none" };
  if (pattern === "hatch") return {
    light: "repeating-linear-gradient(135deg, rgba(0, 0, 0, 0.06) 0 1px, transparent 1px 10px)",
    dark: "repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.06) 0 1px, transparent 1px 10px)",
  };
  return {
    light: "linear-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 0, 0.05) 1px, transparent 1px)",
    dark: "linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)",
  };
}

function prefix(
  values: Readonly<Record<string, string>>,
  mode: "light" | "dark",
): Record<`--theme-${typeof mode}-${string}`, string> {
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => [`--theme-${mode}-${name}`, value]),
  ) as Record<`--theme-${typeof mode}-${string}`, string>;
}
