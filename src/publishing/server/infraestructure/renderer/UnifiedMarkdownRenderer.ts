import type { MarkdownExtension } from "../../../../rendering/shared/MarkdownExtension";
import { renderMarkdown } from "../../../../rendering/shared/renderMarkdown";
import {
  createRendererFingerprint,
  RENDERER_VERSION,
} from "../../../../rendering/shared/rendererFingerprint";
import type { DocumentRenderer, RenderedDocument } from "../../domain/render";

// TODO: Hacer que el renderizador estraiga los headings para TOC

export class UnifiedMarkdownRenderer implements DocumentRenderer {
  readonly fingerprint: string;

  constructor(
    private readonly extensions: readonly MarkdownExtension[] = [],
  ) {
    this.fingerprint = createRendererFingerprint(RENDERER_VERSION, extensions);
  }

  async render(document: { getContent(): string }): Promise<RenderedDocument> {
    const html = await renderMarkdown(document.getContent(), this.extensions);
    return { Content: html };
  }
}
