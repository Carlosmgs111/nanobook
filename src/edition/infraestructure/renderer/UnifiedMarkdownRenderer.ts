import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import rehypeShiki from "@shikijs/rehype";
import { Result } from "../../../shared/domain/Result";
import { EditionRenderError } from "../../domain/errors";
import type { PreviewRenderer } from "../../domain/ports/PreviewRenderer";

// TODO: Hacer que el renderizador estraiga los headings para TOC

export class UnifiedMarkdownRenderer implements PreviewRenderer {
  private processor: any = null;

  private async getProcessor() {
    if (this.processor) return this.processor;

    this.processor = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype)
      .use(rehypeSlug)
      .use(rehypeShiki, {
        theme: "github-dark",
      })
      .use(rehypeStringify);

    return this.processor;
  }

  async render(
    document: string
  ): Promise<Result<EditionRenderError, { Content: string }>> {
    try {
      const processor = await this.getProcessor();
      const result = await processor.process(document);

      return Result.ok({
        Content: String(result),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return Result.fail(new EditionRenderError(reason, { cause: error }));
    }
  }
}
