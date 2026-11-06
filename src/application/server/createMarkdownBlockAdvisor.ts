import type { MarkdownBlockAdvisor } from "../../agents/server";
import { financialAuthoringGuide, validateMarkdownBlocks } from "../../financial-content/shared";

/**
 * Compone lo que el agente necesita saber de los bloques especiales del
 * contenido. Es la única pieza que une `agents` con `financial-content`.
 */
export function createMarkdownBlockAdvisor(): MarkdownBlockAdvisor {
  return {
    guide: () => financialAuthoringGuide,
    validate: (content) => validateMarkdownBlocks(content),
  };
}
