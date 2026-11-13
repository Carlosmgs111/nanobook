import type { BlockRegistry } from "../../rendering/shared";
import { financialAuthoringGuide } from "../shared/guide/financialAuthoringGuide";
import { validateMarkdownBlocks, type MarkdownBlockIssue } from "../shared/validation/validateMarkdownBlocks";
import { financialBlocks } from "./blocks";

export class FinancialContentModule {
  private constructor(
    /** Lo que un agente necesita para escribir bloques: guía de autoría y validación de lo que escribe. */
    public readonly markdownBlockAdvisor: {
      guide(): string;
      validate(content: string): readonly MarkdownBlockIssue[];
    },
  ) {}

  /** Registra sus bloques en `blocks`: solo existen en la aplicación que compone este módulo. */
  static create(blocks: BlockRegistry): FinancialContentModule {
    blocks.register(financialBlocks);
    return new FinancialContentModule({
      guide: () => financialAuthoringGuide,
      validate: (content) => validateMarkdownBlocks(content, blocks.blocks),
    });
  }
}
