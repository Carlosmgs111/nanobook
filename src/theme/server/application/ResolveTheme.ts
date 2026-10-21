import {
  OfficialThemeCatalog,
  type OfficialThemeId,
} from "../infraestructure/OfficialThemeCatalog";
import { cornerImage, coverValues, hatchImage, pagePatternImage, shadowValue, rhythmValues, readingMeasureValue, densityValues } from "../../shared/ThemePresets";
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

  async execute(reference: ThemeReference | undefined, _request?: Request): Promise<AppliedTheme> {
    const selected = reference ?? { kind: "official", id: "classic" } as const;
    if (selected.kind === "custom") {
      const found = await this.repository.findById(selected.id);
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
    const definition = this.catalog.get(selected.id);
    const values = overlayTokens(definition.light, definition.dark, {});
    return {
      key: `official:${definition.id}`,
      baseId: definition.id,
      lightVariables: prefix(values.light, "light"),
      darkVariables: prefix(values.dark, "dark"),
    };
  }
}

const COLOR_NAMES = {
  pageBg: "page-bg", surfaceBg: "surface-bg", text: "text", textMuted: "text-muted",
  accent: "accent", border: "border", borderSubtle: "border-subtle",
  accentText: "accent-text", statusError: "status-error",
  statusWarning: "status-warning", statusSuccess: "status-success",
  statusInfo: "status-info",
  link: "link", focusRing: "focus-ring", selectionBg: "selection-bg",
  selectionText: "selection-text", surfaceRaised: "surface-raised",
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
    const modeTokens = tokens[mode] ?? {};
    if (!modeTokens.link) target.link = target.accent;
    if (!modeTokens.focusRing) target["focus-ring"] = target.accent;
    if (!modeTokens.selectionBg) target["selection-bg"] = target.accent;
    if (!modeTokens.selectionText) target["selection-text"] = target["accent-text"];
    if (!modeTokens.surfaceRaised) target["surface-raised"] =
      `color-mix(in srgb, var(--theme-${mode}-surface-bg) 92%, var(--theme-${mode}-text) 8%)`;
  }

  const fonts = {
    "system-sans": "system-ui, sans-serif",
    "editorial-serif": 'Georgia, "Times New Roman", serif',
    mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  } as const;
  if (tokens.typography) for (const target of [light, dark]) {
    if (tokens.typography.family) target["font-body"] = fonts[tokens.typography.family];
    if (tokens.typography.heading) target["font-heading"] = fonts[tokens.typography.heading];
    else if (tokens.typography.family) target["font-heading"] = fonts[tokens.typography.family];
    if (tokens.typography.code) target["font-code"] = fonts[tokens.typography.code];
    if (tokens.typography.scale) target["font-scale"] = {
      small: "0.875rem", normal: "1rem", large: "1.125rem",
    }[tokens.typography.scale];
    if (tokens.typography.rhythm) {
      const rhythm = rhythmValues(tokens.typography.rhythm);
      target["body-line-height"] = rhythm.lineHeight;
      target["heading-scale"] = rhythm.headingScale;
      target["paragraph-gap"] = rhythm.paragraphGap;
    }
  }

  const radius = { square: "0px", soft: "5px", rounded: "14px" }[tokens.shape?.radius ?? "square"];
  if (tokens.shape) for (const target of [light, dark]) {
    if (tokens.shape.radius) {
      target["control-radius"] = radius;
      target["panel-radius"] = radius;
    }
    if (tokens.shape.cover) {
      const cover = coverValues(tokens.shape.cover);
      target["cover-radius"] = cover.radius;
      target["cover-spine-width"] = cover.spine;
    }
  }

  if (tokens.layout) for (const target of [light, dark]) {
    if (tokens.layout.density) {
      const density = densityValues(tokens.layout.density);
      target["content-gap"] = density.contentGap;
      target["space-inline"] = density.inline;
      target["space-block"] = density.block;
      target["space-section"] = density.section;
    }
    if (tokens.layout.readingMeasure) target["reading-measure"] = readingMeasureValue(tokens.layout.readingMeasure);
  }

  if (tokens.decoration) {
    if (tokens.decoration.pattern) {
      light["decoration-hatch-image"] = hatchImage(tokens.decoration.pattern);
      dark["decoration-hatch-image"] = hatchImage(tokens.decoration.pattern);
      if (!tokens.decoration.pagePattern) {
        const legacyPagePattern = pagePatternImage(tokens.decoration.pattern);
        light["page-pattern"] = legacyPagePattern;
        dark["page-pattern"] = legacyPagePattern;
      }
    }
    if (tokens.decoration.pagePattern) {
      const pagePattern = pagePatternImage(tokens.decoration.pagePattern);
      light["page-pattern"] = pagePattern;
      dark["page-pattern"] = pagePattern;
    }
    if (tokens.decoration.corners) {
      const image = cornerImage(tokens.decoration.corners);
      light["decoration-corner-image"] = image;
      dark["decoration-corner-image"] = image;
    }
    if (tokens.decoration.shadow) {
      const shadow = shadowValue(tokens.decoration.shadow);
      light["decoration-shadow"] = shadow;
      dark["decoration-shadow"] = shadow;
    }
  }
  return { light, dark };
}

function prefix(
  values: Readonly<Record<string, string>>,
  mode: "light" | "dark",
): Record<`--theme-${typeof mode}-${string}`, string> {
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => [`--theme-${mode}-${name}`, value]),
  ) as Record<`--theme-${typeof mode}-${string}`, string>;
}
