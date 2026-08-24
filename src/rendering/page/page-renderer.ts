import { createNavigationService } from "../../navigation/service/service";
import type {
  Crumb,
  NavigationNode,
  ParentEntry,
} from "../../navigation/model/types";
import type { ContentRepository, Document } from "../../document/model/types";
import type { DocumentRenderer, RenderedDocument } from "../model/types";

export interface RenderedPageData {
  pageId: string;
  document: Document;
  renderedBody: string;
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
 */
export class PageRenderer {
  constructor(
    private repository: ContentRepository,
    private markdownRenderer: DocumentRenderer,
  ) {}

  async render(documentId: string): Promise<RenderedPageData | null> {
    const document = await this.repository.get(documentId);
    if (!document) return null;

    const allDocuments = await this.repository.list();
    const navigation = createNavigationService(allDocuments);

    const rendered = await this.markdownRenderer.render(document);

    return {
      pageId: documentId,
      document,
      renderedBody: rendered.Content,
      breadcrumbs: navigation.getBreadcrumbs(document.id),
      sidebarEntries: navigation.getSidebarEntries(document.id),
      parentEntry: navigation.getParentEntry(document.id),
      childEntries: document.metadata.index
        ? navigation.getImmediateChildren(document.id, document.id)
        : [],
    };
  }
}
