import type { RedisClientType } from "redis";
import type { CachedPage, RenderedPageCache } from "../../domain/cache";

function buildKey(pageId: string): string {
  return `nanobook:page:${pageId}`;
}

/**
 * Cache de páginas renderizadas sobre Redis.
 *
 * Persiste cuerpos renderizados de forma independiente a la plataforma de
 * despliegue. Funciona con cualquier servidor Redis compatible, incluyendo
 * Upstash Redis en Vercel, Redis Cloud, ElastiCache, etc.
 */
export class RedisRenderedPageCache implements RenderedPageCache {
  constructor(private client: RedisClientType) {}

  private async ensureConnected(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  async get(pageId: string, contentHash: string): Promise<CachedPage | null> {
    await this.ensureConnected();

    const raw = await this.client.get(buildKey(pageId));
    if (!raw) return null;

    try {
      const cached = JSON.parse(raw) as CachedPage;
      if (cached.contentHash !== contentHash) return null;
      return cached;
    } catch {
      return null;
    }
  }

  async set(
    pageId: string,
    contentHash: string,
    html: string,
  ): Promise<void> {
    await this.ensureConnected();

    const cached: CachedPage = {
      pageId,
      contentHash,
      html,
      renderedAt: new Date().toISOString(),
    };

    await this.client.set(buildKey(pageId), JSON.stringify(cached));
  }

  async invalidate(pageIds: string[]): Promise<void> {
    await this.ensureConnected();

    if (pageIds.length === 0) return;

    const keys = pageIds.map(buildKey);
    await this.client.del(keys);
  }
}
