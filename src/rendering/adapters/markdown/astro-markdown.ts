import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import type { DocumentRenderer, RenderedDocument } from "../../model/types";

export class AstroMarkdownRenderer implements DocumentRenderer {
  private processor: Awaited<
    ReturnType<typeof createMarkdownProcessor>
  > | null = null;

  private async getProcessor() {
    if (this.processor) return this.processor;

    this.processor = await createMarkdownProcessor({
      syntaxHighlight: "shiki",
      shikiConfig: {
        theme: "github-dark",
      },
    });

    return this.processor;
  }

  async render(document: {
    id: string;
    content: string;
  }): Promise<RenderedDocument> {
    const processor = await this.getProcessor();

    const result = await processor.render(document.content);

    return {
      Content: result,
      headings: [],
      remarkPluginFrontmatter: {},
    } as RenderedDocument;
  }
}