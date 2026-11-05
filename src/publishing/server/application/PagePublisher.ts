import type { Result } from "../../../shared/domain/Result";
import type { RenderedPageCache } from "../domain/cache";
import type { DocumentRenderer, RenderedDocumentPage } from "../domain/render";
import type { Document } from "../../../documents/server";
import type { PageCacheError } from "../infraestructure/errors";

function renderedCacheHash(
  rendererFingerprint: string,
  contentHash: string,
): string {
  return `${rendererFingerprint}:${contentHash}`;
}

export class PagePublisher {
  constructor(
    private pageRenderer: DocumentRenderer,
    private pageCache: RenderedPageCache,
  ) {}

  async publish(document: Document): Promise<RenderedDocumentPage | null> {
    const contentHash = await document.computeContentHash();
    const documentId = document.getDocumentId().getValue();
    const renderedBody = await this.resolveRenderedBody(
      document,
      documentId,
      contentHash
    );

    const entry = document.parse();
    const rendered = {
      pageId: documentId,
      entry,
      renderedBody,
    };

    return { rendered, headings: entry.headings, contentHash };
  }

  async invalidate(
    documentIds: string[]
  ): Promise<Result<PageCacheError, void>> {
    return this.pageCache.invalidate(documentIds);
  }

  private async resolveRenderedBody(
    document: Document,
    documentId: string,
    contentHash?: string
  ): Promise<string> {
    const cacheHash = contentHash &&
      renderedCacheHash(this.pageRenderer.fingerprint, contentHash);
    if (this.pageCache && cacheHash) {
      const cached = await this.pageCache.get(documentId, cacheHash);
      if (cached) {
        return cached.html;
      }
    }

    const rendered = await this.pageRenderer.render(document);

    if (this.pageCache && cacheHash) {
      await this.pageCache.set(documentId, cacheHash, rendered.Content);
    }

    return rendered.Content;
  }

}
