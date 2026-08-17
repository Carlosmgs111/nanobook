import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import rehypeShiki from "@shikijs/rehype";
import type { DocumentRenderer, RenderedDocument } from "../types";

// TODO: Hacer que el renderizador estraiga los headings para TOC

export class UnifiedMarkdownRenderer implements DocumentRenderer {
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

  async render(document: {
    id: string;
    content: string;
  }): Promise<RenderedDocument> {
    const processor = await this.getProcessor();
    const result = await processor.process(document.content);

    return {
      Content: String(result),
      headings: [], // Los headings se extraen en el consumer con parseDocument()
      remarkPluginFrontmatter: {},
    } as unknown as RenderedDocument;
  }
}
