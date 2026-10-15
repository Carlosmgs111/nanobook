import { Result } from "../../../../shared/domain/Result";
import type { Theme } from "../../domain/Theme";
import { InvalidThemeError } from "../../domain/errors";
import type { ThemeTokens } from "../../domain/ThemeTokens";

export interface ThemePaletteDto {
  pageBackground?: string; surfaceBackground?: string; text?: string;
  textMuted?: string; accent?: string; border?: string;
}
export interface ThemeTokensDto {
  light?: ThemePaletteDto; dark?: ThemePaletteDto;
  typography?: { family?: "system-sans" | "editorial-serif" | "mono" };
  shape?: { radius?: "square" | "soft" | "rounded" };
  layout?: { density?: "compact" | "comfortable" | "relaxed" };
  decoration?: { pattern?: "none" | "grid" | "hatch" };
}
export interface ThemeSummary {
  reference: { kind: "official" | "custom"; id: string };
  name: string; baseThemeId: "classic" | "nanobook"; editable: boolean;
}
export interface ThemeDetails extends ThemeSummary { tokens: ThemeTokensDto; }

const ROOT_KEYS = ["light", "dark", "typography", "shape", "layout", "decoration"];
const PALETTE_KEYS = ["pageBackground", "surfaceBackground", "text", "textMuted", "accent", "border"];
const mapping = { pageBackground: "pageBg", surfaceBackground: "surfaceBg", text: "text", textMuted: "textMuted", accent: "accent", border: "border" } as const;

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
    typography: ["family", ["system-sans", "editorial-serif", "mono"]],
    shape: ["radius", ["square", "soft", "rounded"]],
    layout: ["density", ["compact", "comfortable", "relaxed"]],
    decoration: ["pattern", ["none", "grid", "hatch"]],
  } as const;
  for (const [group, [key, allowed]] of Object.entries(groups) as Array<[keyof typeof groups, readonly [string, readonly string[]]]>) {
    const entry = value[group];
    if (entry === undefined) continue;
    if (!record(entry) || Object.keys(entry).length !== 1 || !allowed.includes(entry[key] as string)) return Result.fail(new InvalidThemeError(`${group}.${key} es inválido`));
    (tokens as any)[group] = { [key]: entry[key] };
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
