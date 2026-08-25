import { createContentRepository } from "../../document/adapters/repository/factory";
import { computeContentHash } from "../../document/model/hash";
import { createRenderedPageCache } from "../adapters/cache/factory";
import { UnifiedMarkdownRenderer } from "../adapters/markdown/unified-markdown";
import { PageRenderer, type RenderedPageData } from "./page-renderer";

export interface RenderDocumentPageResult {
  rendered: RenderedPageData;
  contentHash: string;
}

/**
 * Renderiza una página de contenido en runtime.
 *
 * - Crea el ContentRepository y el RenderedPageCache según configuración.
 * - Obtiene el documento por slug.
 * - Calcula el hash de contenido para la clave de cache.
 * - Usa PageRenderer para obtener cuerpo y navegación.
 */
export async function renderDocumentPage(
  slug: string,
): Promise<RenderDocumentPageResult | null> {
  const documentId = slug || "index";

  const repository = await createContentRepository();
  const document = await repository.get(documentId);

  if (!document) {
    return null;
  }

  const cache = createRenderedPageCache();
  const renderer = new PageRenderer(
    repository,
    new UnifiedMarkdownRenderer(),
    cache,
  );

  const contentHash = computeContentHash(document);
  const rendered = await renderer.render(documentId, contentHash);

  if (!rendered) {
    return null;
  }

  return { rendered, contentHash };
}
