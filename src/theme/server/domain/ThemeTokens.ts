import { InvalidThemeError } from "./errors";

const COLOR_KEYS = [
  "pageBg",
  "surfaceBg",
  "text",
  "textMuted",
  "accent",
  "border",
  "borderSubtle",
  "accentText",
  "statusError",
  "statusWarning",
  "statusSuccess",
  "statusInfo",
  "link",
  "focusRing",
  "selectionBg",
  "selectionText",
  "surfaceRaised",
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
  typography?: {
    family?: "system-sans" | "editorial-serif" | "mono";
    heading?: "system-sans" | "editorial-serif" | "mono";
    code?: "system-sans" | "editorial-serif" | "mono";
    scale?: "small" | "normal" | "large";
    rhythm?: "compact" | "balanced" | "airy";
  };
  shape?: {
    radius?: "square" | "soft" | "rounded";
    cover?: "book" | "square" | "rounded";
  };
  layout?: { density?: "compact" | "comfortable" | "relaxed"; readingMeasure?: "narrow" | "standard" | "wide" | "full" };
  decoration?: {
    pattern?: "none" | "grid" | "texture" | "stripes" | "hatch";
    patternScale?: "fine" | "regular" | "coarse";
    patternContrast?: "subtle" | "balanced" | "strong";
    /** @deprecated Read only for themes persisted before global pattern primitives. */
    pagePattern?: "none" | "grid" | "texture" | "stripes" | "hatch";
    corners?: "none" | "cross" | "line";
    shadow?: "flat" | "offset" | "soft";
  };
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

  const presetChecks = {
    typography: {
      family: ["system-sans", "editorial-serif", "mono"],
      heading: ["system-sans", "editorial-serif", "mono"],
      code: ["system-sans", "editorial-serif", "mono"],
      scale: ["small", "normal", "large"],
      rhythm: ["compact", "balanced", "airy"],
    },
    shape: {
      radius: ["square", "soft", "rounded"],
      cover: ["book", "square", "rounded"],
    },
    layout: { density: ["compact", "comfortable", "relaxed"], readingMeasure: ["narrow", "standard", "wide", "full"] },
    decoration: {
      pattern: ["none", "grid", "texture", "stripes", "hatch"],
      patternScale: ["fine", "regular", "coarse"],
      patternContrast: ["subtle", "balanced", "strong"],
      pagePattern: ["none", "grid", "texture", "stripes", "hatch"],
      corners: ["none", "cross", "line"],
      shadow: ["flat", "offset", "soft"],
    },
  } as const;
  for (const [group, fields] of Object.entries(presetChecks) as Array<[
    keyof typeof presetChecks,
    Record<string, readonly string[]>,
  ]>) {
    const entry = value[group];
    if (entry === undefined) continue;
    if (
      !isRecord(entry) ||
      Object.keys(entry).length === 0 ||
      Object.keys(entry).some((key) => !(key in fields))
    ) {
      return new InvalidThemeError(`${group} contiene campos no permitidos`);
    }
    for (const [key, selected] of Object.entries(entry)) {
      if (!fields[key].includes(selected as string)) {
        return new InvalidThemeError(`${group}.${key} es inválido`);
      }
    }
  }

  const tokens = structuredClone(value) as ThemeTokens;
  const legacyPagePattern = tokens.decoration?.pagePattern;
  if (legacyPagePattern !== undefined) {
    tokens.decoration.pattern ??= legacyPagePattern;
    delete tokens.decoration.pagePattern;
  }
  return tokens;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
