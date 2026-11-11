import { createComponentBlocksExtension } from "../../rendering/shared/componentBlocks/createComponentBlocksExtension";
import { assertUniqueFenceLanguages, type MarkdownExtension } from "../../rendering/shared/MarkdownExtension";
import { blockRegistry } from "./blocks";

/**
 * Única lista de extensiones Markdown de la aplicación. Publicación (servidor)
 * y vista previa (navegador) la consumen para producir el mismo HTML.
 *
 * Todos los bloques (gráficos, fichas financieras, componentes de demostración)
 * se registran explícitamente en `blocks.ts` y los resuelve una sola extensión;
 * Astro los renderiza.
 */
export function createMarkdownExtensions(): readonly MarkdownExtension[] {
  const extensions = [
    createComponentBlocksExtension({
      id: "component-blocks",
      // 2: las fichas financieras pasan de ser HTML del pipeline a componentes .astro.
      version: "2",
      definitions: blockRegistry.blocks,
    }),
  ];
  assertUniqueFenceLanguages(extensions);
  return extensions;
}
