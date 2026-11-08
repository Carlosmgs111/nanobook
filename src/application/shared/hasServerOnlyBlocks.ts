import { splitComponentBlocks } from "../../rendering/shared/componentBlocks/splitComponentBlocks";

/**
 * Indica si el HTML contiene bloques de raíz que el servidor pinta como isla.
 * Ese HTML solo se puede mostrar bien tal como lo entrega el servidor: el que
 * produce el Worker del navegador deja esos bloques como su contenido
 * alternativo (la fence en texto) y nada lo vuelve a convertir en isla.
 */
export function hasServerOnlyBlocks(html: string, ssrBlockNames: ReadonlySet<string>): boolean {
  return splitComponentBlocks(html).some((segment) => segment.kind === "block" && ssrBlockNames.has(segment.name));
}
