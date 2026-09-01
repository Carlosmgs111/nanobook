import type { RenderedPageCache } from "../domain/cache";
import type { DocumentRenderer, RenderedDocumentPage } from "../domain/render";
import type { Document } from "../../document";

export class PagePublisher {
  constructor(
    private pageRenderer: DocumentRenderer,
    private pageCache: RenderedPageCache,
  ) {}

  async publish(document: Document): Promise<RenderedDocumentPage | null> {
    const contentHash = await document.computeContentHash();
    const renderedBody = await this.resolveRenderedBody(
      document,
      document.getId().getValue(),
      contentHash
    );

    const rendered = {
      pageId: document.getId().getValue(),
      document,
      renderedBody,
    };
    if (!rendered) {
      return null;
    }

    const { headings } = document.parse();

    return { rendered, headings, contentHash };
  }

  async invalidate(documentIds: string[]): Promise<void> {
    await this.pageCache.invalidate(documentIds);
  }

  private async resolveRenderedBody(
    document: Document,
    documentId: string,
    contentHash?: string
  ): Promise<string> {
    if (this.pageCache && contentHash) {
      const cached = await this.pageCache.get(documentId, contentHash);
      if (cached) {
        return cached.html;
      }
    }

    const rendered = await this.pageRenderer.render(document);

    if (this.pageCache && contentHash) {
      await this.pageCache.set(documentId, contentHash, rendered.Content);
    }

    return rendered.Content;
  }
}
