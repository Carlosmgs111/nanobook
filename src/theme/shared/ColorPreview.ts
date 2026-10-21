/** Convierte los colores semitransparentes del catálogo a una muestra RGB para input[type=color]. */
export function colorInputValue(
  value: string | undefined,
  background: string
): string {
  if (value && /^#[0-9a-f]{6}$/i.test(value)) return value;
  const match = value?.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i
  );
  if (!match || !/^#[0-9a-f]{6}$/i.test(background)) return background;
  const alpha = Number(match[4] ?? 1);
  if (alpha < 0 || alpha > 1) return background;
  const channels = [1, 3, 5].map((offset, index) => {
    const foreground = Number(match[index + 1]);
    const behind = Number.parseInt(background.slice(offset, offset + 2), 16);
    return Math.round(foreground * alpha + behind * (1 - alpha))
      .toString(16)
      .padStart(2, "0");
  });
  return `#${channels.join("")}`;
}

export function raisedColorInputValue(surface: string, text: string, page: string): string {
  const resolvedSurface = colorInputValue(surface, page);
  if (!/^#[0-9a-f]{6}$/i.test(resolvedSurface) || !/^#[0-9a-f]{6}$/i.test(text)) return page;
  const channels = [1, 3, 5].map((offset) => {
    const background = parseInt(resolvedSurface.slice(offset, offset + 2), 16);
    const foreground = parseInt(text.slice(offset, offset + 2), 16);
    return Math.round(background * 0.92 + foreground * 0.08).toString(16).padStart(2, "0");
  });
  return `#${channels.join("")}`;
}
