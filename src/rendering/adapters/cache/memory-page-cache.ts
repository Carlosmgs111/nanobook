import type { CachedPage, RenderedPageCache } from "../../model/types";

/**
 * Cache de páginas renderizadas en memoria.
 *
 * Útil en entornos serverless donde el filesystem es efímero y no se dispone
 * de un almacén persistente como Redis o KV. Los datos se pierden al finalizar
 * la invocación, pero aceleran el renderizado de múltiples documentos dentro
 * de una misma petición.
 */
export class MemoryRenderedPageCache implements RenderedPageCache {
  private store = new Map<string, CachedPage>();

  async get(pageId: string, contentHash: string): Promise<CachedPage | null> {
    const cached = this.store.get(pageId);
    if (!cached || cached.contentHash !== contentHash) return null;
    return cached;
  }

  async set(
    pageId: string,
    contentHash: string,
    html: string,
  ): Promise<void> {
    const cached: CachedPage = {
      pageId,
      contentHash,
      html,
      renderedAt: new Date().toISOString(),
    };

    this.store.set(pageId, cached);
  }

  async invalidate(pageIds: string[]): Promise<void> {
    for (const pageId of pageIds) {
      this.store.delete(pageId);
    }
  }

  /** Expone el tamaño actual del cache; útil para tests y diagnóstico. */
  size(): number {
    return this.store.size;
  }

  /** Limpia todo el cache; útil para tests. */
  clear(): void {
    this.store.clear();
  }
}
