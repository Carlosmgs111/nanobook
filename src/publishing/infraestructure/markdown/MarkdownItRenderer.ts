import MarkdownIt from "markdown-it";
import { fromHighlighter } from "@shikijs/markdown-it";
import { createBundledHighlighter } from "@shikijs/core";
import { createJavaScriptRegexEngine } from "@shikijs/engine-javascript";
import { bundledLanguages } from "shiki/langs";
import { bundledThemes } from "shiki/themes";
import anchor from "markdown-it-anchor";
import type { RenderedDocument } from "../../domain/render";
import type { SerializedEntry } from "../../../document/application/dto/SerializedEntry";

const createHighlighter = createBundledHighlighter({
  langs: bundledLanguages,
  themes: bundledThemes,
  engine: () => createJavaScriptRegexEngine({ forgiving: true }),
});

export class MarkdownItRenderer {
  private processor: MarkdownIt | null = null;

  private async getProcessor(): Promise<MarkdownIt> {
    if (this.processor) {
      return this.processor;
    }

    const highlighter = await createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: Object.keys(bundledLanguages),
    });

    const shiki = fromHighlighter(highlighter, {
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
      .use(shiki);

    return this.processor;
  }

  async render(document: Pick<SerializedEntry, "content">): Promise<RenderedDocument> {
    const processor = await this.getProcessor();

    const Content = processor.render(document.content);

    return {
      Content,
    };
  }
}
