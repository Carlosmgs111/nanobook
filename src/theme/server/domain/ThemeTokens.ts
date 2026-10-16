import { InvalidThemeError } from "./errors";

const COLOR_KEYS = [
  "pageBg",
  "surfaceBg",
  "text",
  "textMuted",
  "accent",
  "border",
  "borderSubtle",
] as const;
const ROOT_KEYS = [
  "light",
  "dark",
  "typography",
  "shape",
  "layout",
  "decoration",
] as const;

type ColorKey = (typeof COLOR_KEYS)[number];
export type ThemeColorTokens = Partial<Record<ColorKey, string>>;
export type ThemeTokens = {
  light?: ThemeColorTokens;
  dark?: ThemeColorTokens;
  typography?: { family: "system-sans" | "editorial-serif" | "mono" };
  shape?: { radius: "square" | "soft" | "rounded" };
  layout?: { density: "compact" | "comfortable" | "relaxed" };
  decoration?: { pattern: "none" | "grid" | "hatch" };
};

export function validateThemeTokens(
  value: unknown
): ThemeTokens | InvalidThemeError {
  if (!isRecord(value))
    return new InvalidThemeError("tokens debe ser un objeto");
  if (
    Object.keys(value).some(
      (key) => !ROOT_KEYS.includes(key as (typeof ROOT_KEYS)[number])
    )
  ) {
    return new InvalidThemeError("tokens contiene campos no permitidos");
  }

  for (const mode of ["light", "dark"] as const) {
    const colors = value[mode];
    if (colors === undefined) continue;
    if (
      !isRecord(colors) ||
      Object.keys(colors).some((key) => !COLOR_KEYS.includes(key as ColorKey))
    ) {
      return new InvalidThemeError(`${mode} contiene campos no permitidos`);
    }
    if (
      Object.values(colors).some(
        (color) => typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color)
      )
    ) {
      return new InvalidThemeError(`${mode} contiene un color inválido`);
    }
  }

  const presetChecks = [
    ["typography", "family", ["system-sans", "editorial-serif", "mono"]],
    ["shape", "radius", ["square", "soft", "rounded"]],
    ["layout", "density", ["compact", "comfortable", "relaxed"]],
    ["decoration", "pattern", ["none", "grid", "hatch"]],
  ] as const;
  for (const [group, key, allowed] of presetChecks) {
    const entry = value[group];
    if (entry === undefined) continue;
    if (
      !isRecord(entry) ||
      Object.keys(entry).length !== 1 ||
      !allowed.includes(entry[key] as never)
    ) {
      return new InvalidThemeError(`${group}.${key} es inválido`);
    }
  }

  return structuredClone(value) as ThemeTokens;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
