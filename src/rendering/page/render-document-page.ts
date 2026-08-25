import { createContentRepository } from "../../document/adapters/repository/factory";
import { computeContentHash } from "../../document/model/hash";
import { parseDocument } from "../../document/parse/document";
import type { Heading } from "../../document/parse/document";
import { createRenderedPageCache } from "../adapters/cache/factory";
import { UnifiedMarkdownRenderer } from "../adapters/markdown/unified-markdown";
import { PageRenderer, type RenderedPageData } from "./page-renderer";

export interface RenderDocumentPageResult {
  rendered: RenderedPageData;
  headings: Heading[];
  contentHash: string;
}

/**
 * Renderiza una página de contenido en runtime.
 *
 * - Crea el ContentRepository y el RenderedPageCache según configuración.
 * - Obtiene el documento por slug.
 * - Calcula el hash de contenido para la clave de cache.
 * - Usa PageRenderer para obtener cuerpo y navegación.
 * - Extrae los headings con parseDocument para el TOC.
 *
 * Nota: los headings se extraen del documento, no del HTML renderizado. Esto
 * mantiene la responsabilidad de análisis estructural en el dominio document
 * y permite que el renderizador se centre en generar HTML.
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

  const { headings } = parseDocument({ body: document.content });

  return { rendered, headings, contentHash };
}
