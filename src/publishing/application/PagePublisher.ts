import type { RenderedPageCache } from "../domain/cache";
import type { DocumentRenderer, RenderedDocumentPage } from "../domain/render";
import type { ContentService } from "./ContentService.port";
import type { NavigationService } from "./NavigationService.port";

export class PagePublisher {
  constructor(
    private pageRenderer: DocumentRenderer,
    private pageCache: RenderedPageCache,
    private contentService: ContentService,
    private navigationService: NavigationService
  ) {}

  async publish(slug: string): Promise<RenderedDocumentPage | null> {
    const documentId = slug || "index";

    const document = await this.contentService.getDocument(documentId);

    if (!document) {
      return null;
    }
    const contentHash = this.contentService.computeContentHash(document);
    const renderedBody = await this.resolveRenderedBody(
      document,
      documentId,
      contentHash
    );

    const rendered = {
      pageId: documentId,
      document,
      renderedBody,
      breadcrumbs: this.navigationService.getBreadcrumbs(document.id),
      sidebarEntries: this.navigationService.getSidebarEntries(document.id),
      parentEntry: this.navigationService.getParentEntry(document.id),
      childEntries: document.metadata.index
        ? this.navigationService.getImmediateChildren(document.id, document.id)
        : [],
    };
    if (!rendered) {
      return null;
    }

    const { headings } = this.contentService.parseDocument({
      body: document.content,
    });

    return { rendered, headings, contentHash };
  }

  private async resolveRenderedBody(
    document: { id: string; content: string },
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
