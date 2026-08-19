import MarkdownIt from "markdown-it";
import Shiki from "@shikijs/markdown-it";
import anchor from "markdown-it-anchor";

import type { DocumentRenderer, RenderedDocument } from "../types";

export class MarkdownItRenderer implements DocumentRenderer {
  private processor: typeof MarkdownIt | null = null;

  private async getProcessor(): Promise<typeof MarkdownIt> {
    if (this.processor) {
      return this.processor;
    }

    const shiki = await Shiki({
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
    });

    this.processor = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true,
    })
      .use(anchor, {
        slugify: (text: string) =>
          text
            .trim()
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s-]/gu, "")
            .replace(/\s+/g, "-"),
      })
      .use(shiki) as unknown as typeof MarkdownIt;

    return this.processor;
  }

  async render(document: {
    id: string;
    content: string;
  }): Promise<RenderedDocument> {
    const processor = await this.getProcessor();

    const Content = processor.render(document.content);

    return {
      Content,
      headings: [],
      remarkPluginFrontmatter: {},
    } as RenderedDocument;
  }
}
