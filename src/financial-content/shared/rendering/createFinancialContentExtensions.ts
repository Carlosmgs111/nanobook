import { createComponentBlocksExtension } from "../../../rendering/shared/componentBlocks/createComponentBlocksExtension";
import type { MarkdownExtension } from "../../../rendering/shared/MarkdownExtension";
import { financialComponentBlockDefinitions } from "../components/priceChart";
import { createFinancialContentExtension } from "./createFinancialContentExtension";

/** Todas las extensiones Markdown que aporta este módulo, en el orden en que deben ejecutarse. */
export function createFinancialContentExtensions(): readonly MarkdownExtension[] {
  return [
    createFinancialContentExtension(),
    createComponentBlocksExtension({
      id: "financial-components",
      version: "1",
      definitions: financialComponentBlockDefinitions,
    }),
  ];
}
