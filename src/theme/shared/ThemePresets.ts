export function coverValues(cover: "book" | "square" | "rounded") {
  if (cover === "book") return { radius: "3px 9px 9px 3px", spine: "12px" };
  if (cover === "rounded") return { radius: "14px", spine: "0px" };
  return { radius: "0px", spine: "0px" };
}

export function cornerImage(style: "none" | "cross" | "line") {
  if (style === "none") return "none";
  const color = "var(--corner-color, var(--theme-border-strong))";
  const line = `linear-gradient(${color} 0 0)`;
  if (style === "cross") {
    return [
      `${line} left 0 top 6px / 14px 2px no-repeat`,
      `${line} left 6px top 0 / 2px 14px no-repeat`,
      `${line} right 0 top 6px / 14px 2px no-repeat`,
      `${line} right 6px top 0 / 2px 14px no-repeat`,
      `${line} left 0 bottom 6px / 14px 2px no-repeat`,
      `${line} left 6px bottom 0 / 2px 14px no-repeat`,
      `${line} right 0 bottom 6px / 14px 2px no-repeat`,
      `${line} right 6px bottom 0 / 2px 14px no-repeat`,
    ].join(", ");
  }
  return [
    `${line} left 7px top 7px / 10px 1px no-repeat`,
    `${line} left 7px top 7px / 1px 10px no-repeat`,
    `${line} right 7px top 7px / 10px 1px no-repeat`,
    `${line} right 7px top 7px / 1px 10px no-repeat`,
    `${line} left 7px bottom 7px / 10px 1px no-repeat`,
    `${line} left 7px bottom 7px / 1px 10px no-repeat`,
    `${line} right 7px bottom 7px / 10px 1px no-repeat`,
    `${line} right 7px bottom 7px / 1px 10px no-repeat`,
  ].join(", ");
}

export type ThemePattern = "none" | "grid" | "texture" | "stripes" | "hatch";

export function hatchImage(pattern: ThemePattern) {
  if (pattern === "none") return "none";
  if (pattern === "grid") {
    return "linear-gradient(var(--theme-decoration-hatch) 1px, transparent 1px), linear-gradient(90deg, var(--theme-decoration-hatch) 1px, transparent 1px)";
  }
  if (pattern === "stripes") {
    return "repeating-linear-gradient(135deg, var(--theme-decoration-hatch-subtle) 0 1px, transparent 1px 10px)";
  }
  // `hatch` is retained as the legacy spelling for the subtle texture.
  return "repeating-linear-gradient(45deg, var(--theme-decoration-hatch-subtle) 0 1px, transparent 1px 9px)";
}

export function pagePatternImage(pattern: ThemePattern) {
  if (pattern === "none") return "none";
  if (pattern === "grid") {
    return "linear-gradient(var(--theme-decoration-hatch-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--theme-decoration-hatch-subtle) 1px, transparent 1px)";
  }
  if (pattern === "stripes") {
    return "repeating-linear-gradient(135deg, var(--theme-decoration-hatch) 0 2px, transparent 2px 12px)";
  }
  return "repeating-linear-gradient(135deg, var(--theme-decoration-hatch-subtle) 0 1px, transparent 1px 10px)";
}

export function shadowValue(shadow: "flat" | "offset" | "soft") {
  if (shadow === "offset") return "12px 12px 0 var(--theme-border-subtle)";
  if (shadow === "soft")
    return "0 10px 28px color-mix(in srgb, var(--theme-text) 14%, transparent)";
  return "none";
}

export function rhythmValues(rhythm: "compact" | "balanced" | "airy") {
  return {
    compact: { lineHeight: "1.55", headingScale: "0.95", paragraphGap: "1rem" },
    balanced: { lineHeight: "1.75", headingScale: "1", paragraphGap: "1.25rem" },
    airy: { lineHeight: "1.9", headingScale: "1.08", paragraphGap: "1.5rem" },
  }[rhythm];
}

export function readingMeasureValue(measure: "narrow" | "standard" | "wide") {
  return { narrow: "60ch", standard: "72ch", wide: "84ch" }[measure];
}

export function densityValues(density: "compact" | "comfortable" | "relaxed") {
  return {
    compact: { contentGap: "1rem", inline: "0.5rem", block: "0.75rem", section: "1.5rem" },
    comfortable: { contentGap: "1.5rem", inline: "0.75rem", block: "1rem", section: "2rem" },
    relaxed: { contentGap: "2rem", inline: "1rem", block: "1.25rem", section: "2.5rem" },
  }[density];
}
