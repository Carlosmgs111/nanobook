import { createFinancialContentExtension } from "../../financial-content/shared";
import type { MarkdownExtension } from "../../rendering/shared/MarkdownExtension";

export function createMarkdownExtensions(): readonly MarkdownExtension[] {
  return [createFinancialContentExtension()];
}
