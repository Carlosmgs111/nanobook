import { createNavigationService } from "../../navigation/service/service";
import type {
  Crumb,
  NavigationNode,
  ParentEntry,
} from "../../navigation/model/types";
import type { ContentRepository, Document } from "../../document/model/types";
import type { DocumentRenderer, RenderedPageCache } from "../model/types";
import type { Heading } from "../../document/parse/document";

export interface RenderedPageData {
  pageId: string;
  document: Document;
  renderedBody: string;
  headings: Heading[];
  breadcrumbs: Crumb[];
  sidebarEntries: NavigationNode[];
  parentEntry: ParentEntry | null;
  childEntries: NavigationNode[];
}

/**
 * Renderizador de página aislado.
 *
 * Genera el HTML del cuerpo del documento y los datos de navegación
 * necesarios para construir la página final. No renderiza el layout de
 * Astro; eso sigue siendo responsabilidad del build pipeline.
 *
 * Si se proporciona un contentHash, el renderizador consulta el cache de
 * cuerpos para evitar re-renderizar Markdown cuando el contenido no ha
 * cambiado. Los datos de navegación se reconstruyen siempre a partir del
 * repositorio para reflejar cambios en el grafo de documentos.
 */
export class PageRenderer {
  constructor(
    private repository: ContentRepository,
    private markdownRenderer: DocumentRenderer,
    private cache?: RenderedPageCache,
  ) {}

  async render(
    documentId: string,
    contentHash?: string,
  ): Promise<RenderedPageData | null> {
    const document = await this.repository.get(documentId);
    if (!document) return null;

    const allDocuments = await this.repository.list();
    const navigation = createNavigationService(allDocuments);

    const { renderedBody, headings } = await this.resolveRenderedBody(
      document,
      documentId,
      contentHash,
    );

    return {
      pageId: documentId,
      document,
      renderedBody,
      headings,
      breadcrumbs: navigation.getBreadcrumbs(document.id),
      sidebarEntries: navigation.getSidebarEntries(document.id),
      parentEntry: navigation.getParentEntry(document.id),
      childEntries: document.metadata.index
        ? navigation.getImmediateChildren(document.id, document.id)
        : [],
    };
  }

  private async resolveRenderedBody(
    document: { id: string; content: string },
    documentId: string,
    contentHash?: string,
  ): Promise<{ renderedBody: string; headings: Heading[] }> {
    if (this.cache && contentHash) {
      const cached = await this.cache.get(documentId, contentHash);
      if (cached) {
        // Los headings no se almacenan en cache; se re-parsean del documento.
        // Esto es barato y garantiza que coincidan con el documento actual.
        const reRendered = await this.markdownRenderer.render(document);
        return { renderedBody: cached.html, headings: reRendered.headings };
      }
    }

    const rendered = await this.markdownRenderer.render(document);

    if (this.cache && contentHash) {
      await this.cache.set(documentId, contentHash, rendered.Content);
    }

    return { renderedBody: rendered.Content, headings: rendered.headings };
  }
}
