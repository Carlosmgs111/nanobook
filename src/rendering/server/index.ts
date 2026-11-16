import {
  createBlockRegistry,
  createComponentBlocksExtension,
  createMarkdownEngine,
  type BlockRegistry,
  type MarkdownEngine,
} from "../shared";
import { PageRenderer } from "./application/PageRenderer";
import type { EventBus } from "../../shared/domain/bus/EventBus";
import { invalidatePagesOnDocumentChanges } from "./application/invalidatePagesOnDocumentChanges";
import type { RenderedPageCache } from "./domain/RenderedPageCache";
import { VercelRenderedPageCache } from "./infraestructure/cache/VercelRenderedPageCache";
import { DocumentPieceResolver } from "./application/DocumentPieceResolver";

export type {
  DocumentPiece,
  DocumentPieceResolver,
} from "./application/DocumentPieceResolver";
export type {
  PageDocument,
  PageSource,
  RenderedDocumentPage,
} from "./application/PageRenderer";
export type { RenderedPageCache } from "./domain/RenderedPageCache";

export class RenderingModule {
  private constructor(
    /** Registro vacío: cada módulo registra aquí sus bloques cuando se compone. */
    public readonly blocks: BlockRegistry,
    /** El mismo motor que usa la vista previa del navegador. */
    public readonly markdownEngine: MarkdownEngine,
    /** Renderiza páginas reutilizando el HTML cacheado mientras ni el contenido ni el motor cambien. */
    public readonly pageRenderer: PageRenderer,
    public readonly pieceResolver: DocumentPieceResolver
  ) {}

  /**
   * Compone el módulo: la caché de páginas (Runtime Cache de Vercel por defecto) y la
   * suscripción que la invalida cuando un documento cambia o desaparece.
   */
  static create(
    eventBus: EventBus,
    pageCache: RenderedPageCache = new VercelRenderedPageCache()
  ): RenderingModule {
    const blocks = createBlockRegistry();
    const markdownEngine = createMarkdownEngine([
      createComponentBlocksExtension(blocks),
    ]);
    const pageRenderer = new PageRenderer(markdownEngine, pageCache);
    invalidatePagesOnDocumentChanges(eventBus, pageRenderer);
    return new RenderingModule(
      blocks,
      markdownEngine,
      pageRenderer,
      new DocumentPieceResolver(blocks)
    );
  }
}
