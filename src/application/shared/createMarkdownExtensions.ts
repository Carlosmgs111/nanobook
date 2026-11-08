import { createFinancialContentExtensions } from "../../financial-content/shared";
import { createComponentBlocksExtension } from "../../rendering/shared/componentBlocks/createComponentBlocksExtension";
import { assertUniqueFenceLanguages, type MarkdownExtension } from "../../rendering/shared/MarkdownExtension";
import { listFrameworkBlockDefinitions } from "./componentBlockDefinitions";

/**
 * Única lista de extensiones Markdown de la aplicación. Publicación (servidor)
 * y vista previa (navegador) la consumen para producir el mismo HTML.
 */
export function createMarkdownExtensions(): readonly MarkdownExtension[] {
  const extensions = [
    ...createFinancialContentExtensions(),
    // Componentes de framework descubiertos como `*.block.ts` en cada módulo.
    createComponentBlocksExtension({
      id: "component-blocks",
      version: "1",
      definitions: listFrameworkBlockDefinitions(),
    }),
  ];
  assertUniqueFenceLanguages(extensions);
  return extensions;
}
