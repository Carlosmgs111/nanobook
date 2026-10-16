export type ThemeCssVariables = Readonly<Record<string, string>>;

/**
 * Serializa una instalación de tema en una hoja pequeña y determinista.
 * El selector depende únicamente de la presencia de data-theme-key para que
 * el mismo mecanismo funcione para temas oficiales y personalizados.
 */
export function serializeThemeCss(
  variables: ThemeCssVariables,
  selector = ":root[data-theme-key]",
): string {
  const declarations = Object.entries(variables)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([name, value]) => `${name}:${value};`)
    .join("");

  return `${selector}{${declarations}}`;
}
