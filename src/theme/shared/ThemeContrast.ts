type Rgb = [number, number, number];

export interface ContrastIssue {
  mode: "light" | "dark";
  pair: string;
  ratio: number;
  minimum: number;
  status: "insufficient" | "unverifiable";
}

const PAIRS = [
  ["text", "page-bg", 4.5],
  ["text", "surface-bg", 4.5],
  ["text-muted", "page-bg", 4.5],
  ["text-muted", "surface-bg", 4.5],
  ["link", "page-bg", 4.5],
  ["link", "surface-bg", 4.5],
  ["accent-text", "accent", 4.5],
  ["selection-text", "selection-bg", 4.5],
  ["focus-ring", "page-bg", 3],
  ["focus-ring", "surface-bg", 3],
  ["border", "surface-bg", 3],
  ["status-error", "surface-bg", 4.5],
  ["status-warning", "surface-bg", 4.5],
  ["status-success", "surface-bg", 4.5],
  ["status-info", "surface-bg", 4.5],
] as const;

export function analyzeThemeContrast(palettes: {
  light: Readonly<Record<string, string>>;
  dark: Readonly<Record<string, string>>;
}): ContrastIssue[] {
  const issues: ContrastIssue[] = [];
  for (const mode of ["light", "dark"] as const) {
    const palette = palettes[mode];
    for (const [foreground, background, minimum] of PAIRS) {
      const ratio = contrastRatio(
        palette[foreground], palette[background], palette["page-bg"],
      );
      if (Number.isFinite(ratio) && ratio >= minimum) continue;
      issues.push({
        mode, pair: `${foreground}/${background}`, ratio, minimum,
        status: Number.isFinite(ratio) ? "insufficient" : "unverifiable",
      });
    }
  }
  return issues;
}

export function contrastRatio(foreground: string | undefined, background: string | undefined, behind?: string): number {
  const base = parseColor(behind)?.rgb;
  const bg = parseColor(background);
  const fg = parseColor(foreground);
  if (!bg || !fg) return Number.NaN;
  const resolvedBackground = bg.alpha < 1
    ? base && blend(bg.rgb, base, bg.alpha)
    : bg.rgb;
  if (!resolvedBackground) return Number.NaN;
  const resolvedForeground = fg.alpha < 1
    ? blend(fg.rgb, resolvedBackground, fg.alpha)
    : fg.rgb;
  const a = luminance(resolvedForeground);
  const b = luminance(resolvedBackground);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function parseColor(value: string | undefined): { rgb: Rgb; alpha: number } | undefined {
  if (!value) return;
  if (/^#[0-9a-f]{6}$/i.test(value)) {
    return {
      rgb: [1, 3, 5].map((offset) => parseInt(value.slice(offset, offset + 2), 16)) as Rgb,
      alpha: 1,
    };
  }
  const match = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (!match) return;
  const channels = [Number(match[1]), Number(match[2]), Number(match[3])] as Rgb;
  const alpha = Number(match[4] ?? 1);
  if (channels.some((channel) => channel < 0 || channel > 255) || alpha < 0 || alpha > 1) return;
  return { rgb: channels, alpha };
}

function blend(top: Rgb, bottom: Rgb, alpha: number): Rgb {
  return top.map((value, index) => value * alpha + bottom[index] * (1 - alpha)) as Rgb;
}

function luminance(color: Rgb): number {
  const linear = color.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
