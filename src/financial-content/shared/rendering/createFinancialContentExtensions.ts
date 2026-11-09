import type { MarkdownExtension } from "../../../rendering/shared/MarkdownExtension";
import { createFinancialContentExtension } from "./createFinancialContentExtension";

/** Todas las extensiones Markdown que aporta este módulo, en el orden en que deben ejecutarse. */
export function createFinancialContentExtensions(): readonly MarkdownExtension[] {
  return [createFinancialContentExtension()];
}
