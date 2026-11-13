import { Result } from "../../../../shared/domain/Result";
import { EditionRenderError } from "../../domain/errors";
import type { MarkdownEngine, PreviewRenderer } from "../../domain/ports/PreviewRenderer";

// TODO: Hacer que el renderizador estraiga los headings para TOC

export class UnifiedMarkdownRenderer implements PreviewRenderer {
  constructor(private readonly engine: MarkdownEngine) {}

  async render(
    document: string
  ): Promise<Result<EditionRenderError, { Content: string }>> {
    try {
      return Result.ok({ Content: await this.engine.render(document) });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return Result.fail(new EditionRenderError(reason, { cause: error }));
    }
  }
}
