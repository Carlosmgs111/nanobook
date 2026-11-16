import { getCache, type RuntimeCache } from "@vercel/functions";
import { Result } from "../../../../shared/domain/Result";
import { PageCacheError, type CachedPage, type RenderedPageCache } from "../../domain/RenderedPageCache";

/** La Runtime Cache rechaza valores de 2 MB o más; una página así simplemente no se cachea. */
const MAX_ITEM_BYTES = 2 * 1024 * 1024;

const pageTag = (pageId: string) => `page:${pageId}`;

/**
 * Caché de páginas sobre la Runtime Cache de Vercel (`getCache`).
 *
 * Cada entrada se guarda bajo `pageId:contentHash` y se etiqueta con su página,
 * así que invalidar una página es expirar su etiqueta: las versiones anteriores
 * del mismo documento caducan juntas sin tener que conocer sus hashes.
 */
export class VercelRenderedPageCache implements RenderedPageCache {
  constructor(
    private readonly runtimeCache: RuntimeCache = getCache({
      namespace: "rendered-page:v1",
      namespaceSeparator: ":",
    }),
  ) {}

  async get(pageId: string, contentHash: string): Promise<CachedPage | null> {
    try {
      const cached = await this.runtimeCache.get(this.key(pageId, contentHash));
      return isCachedPage(cached) && cached.contentHash === contentHash ? cached : null;
    } catch {
      return null;
    }
  }

  async set(pageId: string, contentHash: string, html: string): Promise<void> {
    const cached: CachedPage = { pageId, contentHash, html, renderedAt: new Date().toISOString() };
    if (new TextEncoder().encode(JSON.stringify(cached)).byteLength >= MAX_ITEM_BYTES) return;

    try {
      await this.runtimeCache.set(this.key(pageId, contentHash), cached, {
        name: `page:${pageId}`,
        tags: [pageTag(pageId)],
      });
    } catch {
      // La caché es opcional: si falla al escribir, la página ya está renderizada.
    }
  }

  async invalidate(pageIds: string[]): Promise<Result<PageCacheError, void>> {
    if (pageIds.length === 0) return Result.ok();
    try {
      await this.runtimeCache.expireTag(pageIds.map(pageTag));
      return Result.ok();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.fail(
        new PageCacheError(`Failed to invalidate Vercel cache: ${message}`, { cause: error }),
      );
    }
  }

  private key(pageId: string, contentHash: string): string {
    return `${pageId}:${contentHash}`;
  }
}

function isCachedPage(value: unknown): value is CachedPage {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as CachedPage).contentHash === "string" &&
    typeof (value as CachedPage).html === "string"
  );
}
