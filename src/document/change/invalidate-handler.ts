import type { ContentRepository } from "../model/types";
import type { DocumentChange, InvalidationResult } from "../../navigation/model/types";
import type { RenderedPageCache } from "../../rendering/model/types";
import { ContentChangeService } from "./change-service";

export interface InvalidateRequest {
  changes: DocumentChange[];
}

export interface InvalidateResponse {
  invalidatedIds: string[];
  addedIds: string[];
  removedIds: string[];
}

/**
 * Invalida del cache las páginas afectadas por un conjunto de cambios.
 *
 * - Calcula los documentos invalidados mediante el grafo de dependencias.
 * - Limpia las entradas correspondientes del RenderedPageCache.
 * - No depende de Astro ni de ninguna plataforma específica.
 */
export async function invalidateCache(
  repository: ContentRepository,
  cache: RenderedPageCache,
  request: InvalidateRequest,
): Promise<InvalidateResponse & InvalidationResult> {
  const changeService = new ContentChangeService(repository);
  const result = await changeService.getInvalidatedIds(request.changes);

  await cache.invalidate(result.invalidatedIds);

  return result;
}
