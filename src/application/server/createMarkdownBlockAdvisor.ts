import type { MarkdownBlockAdvisor } from "../../agents/server";
import { financialAuthoringGuide, validateMarkdownBlocks } from "../../financial-content/shared";
import type { BlockRegistry } from "../../rendering/shared";

/**
 * Compone lo que el agente necesita saber de los bloques especiales del
 * contenido. Valida contra el mismo registro que usa el renderizado.
 */
export function createMarkdownBlockAdvisor(blocks: BlockRegistry): MarkdownBlockAdvisor {
  return {
    guide: () => financialAuthoringGuide,
    validate: (content) => validateMarkdownBlocks(content, blocks.blocks),
  };
}
