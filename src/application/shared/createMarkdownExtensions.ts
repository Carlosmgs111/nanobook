import { createFinancialContentExtensions } from "../../financial-content/shared";
import type { MarkdownExtension } from "../../rendering/shared/MarkdownExtension";

/**
 * Única lista de extensiones Markdown de la aplicación. Publicación (servidor)
 * y vista previa (navegador) la consumen para producir el mismo HTML.
 */
export function createMarkdownExtensions(): readonly MarkdownExtension[] {
  return [...createFinancialContentExtensions()];
}
