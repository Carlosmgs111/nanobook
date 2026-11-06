import type { MarkdownExtension } from "../../../../rendering/shared/MarkdownExtension";
import { renderMarkdown } from "../../../../rendering/shared/renderMarkdown";
import { Result } from "../../../../shared/domain/Result";
import { EditionRenderError } from "../../domain/errors";
import type { PreviewRenderer } from "../../domain/ports/PreviewRenderer";

// TODO: Hacer que el renderizador estraiga los headings para TOC

export class UnifiedMarkdownRenderer implements PreviewRenderer {
  private readonly extensions: readonly MarkdownExtension[];

  constructor(extensions: readonly MarkdownExtension[] = []) {
    this.extensions = Object.freeze([...extensions]);
  }

  async render(
    document: string
  ): Promise<Result<EditionRenderError, { Content: string }>> {
    try {
      const html = await renderMarkdown(document, this.extensions);
      return Result.ok({ Content: html });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return Result.fail(new EditionRenderError(reason, { cause: error }));
    }
  }
}
