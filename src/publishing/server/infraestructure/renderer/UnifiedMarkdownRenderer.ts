import type { DocumentRenderer, MarkdownEngine, RenderedDocument } from "../../domain/render";

// TODO: Hacer que el renderizador estraiga los headings para TOC

export class UnifiedMarkdownRenderer implements DocumentRenderer {
  readonly fingerprint: string;

  constructor(private readonly engine: MarkdownEngine) {
    this.fingerprint = engine.fingerprint;
  }

  async render(document: { getContent(): string }): Promise<RenderedDocument> {
    return { Content: await this.engine.render(document.getContent()) };
  }
}
