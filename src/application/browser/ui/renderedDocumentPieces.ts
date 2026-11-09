import { findFrameworkBlockDefinition } from "../../shared/componentBlockDefinitions";
import { resolveDocumentPieces, type DocumentPiece } from "../../shared/resolveDocumentPieces";
import { ssrBlockNames } from "./generated/ssrBlockNames";

/**
 * Parte el HTML renderizado de un documento en HTML y bloques que la página
 * pinta con Astro. Los bloques que no puedan pintarse conservan su punto de
 * montaje original.
 */
export function resolveRenderedPieces(html: string): DocumentPiece[] {
  return resolveDocumentPieces(html, {
    ssrBlockNames,
    findDefinition: findFrameworkBlockDefinition,
    onInvalidProps: (name) =>
      console.warn(`Bloque "${name}": las props ya no validan al servir; se muestra el contenido alternativo.`),
  });
}

/**
 * Indica si la página pintará algún bloque (isla o solo servidor). El HTML que
 * el editor guarda lo genera el Worker, que no puede renderizar bloques, así que
 * sustituir el cuerpo por él los perdería.
 */
export function documentHasBlocks(html: string): boolean {
  return resolveDocumentPieces(html, { ssrBlockNames, findDefinition: findFrameworkBlockDefinition }).some(
    (piece) => piece.kind === "island",
  );
}
