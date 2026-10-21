import { Result } from "../../../../shared/domain/Result";
import type { Theme } from "../../domain/Theme";
import { InvalidThemeError } from "../../domain/errors";
import type { ThemeTokens } from "../../domain/ThemeTokens";

export interface ThemePaletteDto {
  pageBackground?: string; surfaceBackground?: string; text?: string;
  textMuted?: string; accent?: string; border?: string; borderSubtle?: string;
  accentText?: string; statusError?: string; statusWarning?: string;
  statusSuccess?: string; statusInfo?: string; link?: string; focusRing?: string;
  selectionBg?: string; selectionText?: string; surfaceRaised?: string;
}
export interface ThemeTokensDto {
  light?: ThemePaletteDto; dark?: ThemePaletteDto;
  typography?: { family?: "system-sans" | "editorial-serif" | "mono"; heading?: "system-sans" | "editorial-serif" | "mono"; code?: "system-sans" | "editorial-serif" | "mono"; scale?: "small" | "normal" | "large"; rhythm?: "compact" | "balanced" | "airy" };
  shape?: { radius?: "square" | "soft" | "rounded"; cover?: "book" | "square" | "rounded" };
  layout?: { density?: "compact" | "comfortable" | "relaxed"; readingMeasure?: "narrow" | "standard" | "wide" };
  decoration?: { pattern?: "none" | "grid" | "texture" | "stripes" | "hatch"; pagePattern?: "none" | "grid" | "texture" | "stripes" | "hatch"; corners?: "none" | "cross" | "line"; shadow?: "flat" | "offset" | "soft" };
}
export interface ThemeSummary {
  reference: { kind: "official" | "custom"; id: string };
  name: string; baseThemeId: "classic" | "nanobook"; editable: boolean;
}
export interface ThemeDetails extends ThemeSummary { tokens: ThemeTokensDto; }

const ROOT_KEYS = ["light", "dark", "typography", "shape", "layout", "decoration"];
const PALETTE_KEYS = ["pageBackground", "surfaceBackground", "text", "textMuted", "accent", "border", "borderSubtle", "accentText", "statusError", "statusWarning", "statusSuccess", "statusInfo", "link", "focusRing", "selectionBg", "selectionText", "surfaceRaised"];
const mapping = { pageBackground: "pageBg", surfaceBackground: "surfaceBg", text: "text", textMuted: "textMuted", accent: "accent", border: "border", borderSubtle: "borderSubtle", accentText: "accentText", statusError: "statusError", statusWarning: "statusWarning", statusSuccess: "statusSuccess", statusInfo: "statusInfo", link: "link", focusRing: "focusRing", selectionBg: "selectionBg", selectionText: "selectionText", surfaceRaised: "surfaceRaised" } as const;

export function parseThemeTokensDto(value: unknown): Result<InvalidThemeError, ThemeTokens> {
  if (!record(value) || Object.keys(value).some((key) => !ROOT_KEYS.includes(key))) return Result.fail(new InvalidThemeError("tokens contiene campos no permitidos"));
  const tokens: ThemeTokens = {};
  for (const mode of ["light", "dark"] as const) {
    const palette = value[mode];
    if (palette === undefined) continue;
    if (!record(palette) || Object.keys(palette).some((key) => !PALETTE_KEYS.includes(key))) return Result.fail(new InvalidThemeError(`${mode} contiene campos no permitidos`));
    const mapped: Record<string, string> = {};
    for (const [key, color] of Object.entries(palette)) {
      if (typeof color !== "string") return Result.fail(new InvalidThemeError(`${mode} contiene un color inválido`));
      mapped[mapping[key as keyof typeof mapping]] = color;
    }
    tokens[mode] = mapped;
  }
  const groups = {
    typography: { family: ["system-sans", "editorial-serif", "mono"], heading: ["system-sans", "editorial-serif", "mono"], code: ["system-sans", "editorial-serif", "mono"], scale: ["small", "normal", "large"], rhythm: ["compact", "balanced", "airy"] },
    shape: { radius: ["square", "soft", "rounded"], cover: ["book", "square", "rounded"] },
    layout: { density: ["compact", "comfortable", "relaxed"], readingMeasure: ["narrow", "standard", "wide"] },
    decoration: { pattern: ["none", "grid", "texture", "stripes", "hatch"], pagePattern: ["none", "grid", "texture", "stripes", "hatch"], corners: ["none", "cross", "line"], shadow: ["flat", "offset", "soft"] },
  } as const;
  for (const [group, fields] of Object.entries(groups) as Array<[keyof typeof groups, Record<string, readonly string[]>]>) {
    const entry = value[group];
    if (entry === undefined) continue;
    if (!record(entry) || Object.keys(entry).length === 0 || Object.keys(entry).some((key) => !(key in fields))) {
      return Result.fail(new InvalidThemeError(`${group} contiene campos no permitidos`));
    }
    for (const [key, selected] of Object.entries(entry)) {
      if (typeof selected !== "string" || !fields[key].includes(selected)) {
        return Result.fail(new InvalidThemeError(`${group}.${key} es inválido`));
      }
    }
    (tokens as any)[group] = entry;
  }
  return Result.ok(tokens);
}

export function toThemeDetails(theme: Theme): ThemeDetails {
  const tokens = theme.getTokens();
  const dto: ThemeTokensDto = {};
  for (const mode of ["light", "dark"] as const) {
    const palette = tokens[mode];
    if (!palette) continue;
    dto[mode] = Object.fromEntries(Object.entries(mapping).flatMap(([external, internal]) => palette[internal] ? [[external, palette[internal]]] : []));
  }
  if (tokens.typography) dto.typography = tokens.typography;
  if (tokens.shape) dto.shape = tokens.shape;
  if (tokens.layout) dto.layout = tokens.layout;
  if (tokens.decoration) dto.decoration = tokens.decoration;
  return { reference: { kind: "custom", id: theme.getId() }, name: theme.getName(), baseThemeId: theme.getBaseThemeId(), editable: true, tokens: dto };
}

function record(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
