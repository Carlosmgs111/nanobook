import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import type { DocumentRenderer, RenderedDocument } from "../../domain/render";
import type { Document } from "../../../document/domain/Document";

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

  async render(document: Document): Promise<RenderedDocument> {
    const processor = await this.getProcessor();

    const result = await processor.render(document.getContent());

    return {
      Content: result,
    };
  }
}