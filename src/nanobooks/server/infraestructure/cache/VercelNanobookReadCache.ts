import { getCache, type RuntimeCache } from "@vercel/functions";
import { Result } from "../../../../shared/domain/Result";
import type { NanobookReadCache } from "../../application/NanobookReadCache";
import type { Nanobook } from "../../domain/Nanobook";
import {
  fromNanobookSnapshot,
  toNanobookSnapshot,
} from "../../domain/NanobookSnapshot";
import type { NanobookRepositoryFailure } from "../../domain/ports/NanobookRepository";

const CACHE_TTL_SECONDS = 300;

export class VercelNanobookReadCache implements NanobookReadCache {
  constructor(
    private readonly runtimeCache: RuntimeCache = getCache({
      namespace: "nanobook:v1",
      namespaceSeparator: ":",
    }),
  ) {}

  async getOrLoad(
    slug: string,
    load: () => Promise<Result<NanobookRepositoryFailure, Nanobook | null>>,
  ): Promise<Result<NanobookRepositoryFailure, Nanobook | null>> {
    const key = this.key(slug);
    const cached = await this.read(key);
    if (cached) return Result.ok(cached);

    const result = await load();
    if (!result.isSuccess || !result.getValue()) return result;

    try {
      await this.runtimeCache.set(key, toNanobookSnapshot(result.getValue()), {
        name: `nanobook:${this.normalizeSlug(slug)}`,
        ttl: CACHE_TTL_SECONDS,
      });
    } catch {
      // The SQL result remains valid when Runtime Cache is temporarily unavailable.
    }
    return result;
  }

  async replace(nanobook: Nanobook, previousSlug?: string): Promise<void> {
    const currentKey = this.key(nanobook.getSlug());
    if (previousSlug && this.key(previousSlug) !== currentKey) {
      await this.runtimeCache.delete(this.key(previousSlug));
    }
    await this.runtimeCache.set(currentKey, toNanobookSnapshot(nanobook), {
      name: `nanobook:${nanobook.getSlug()}`,
      ttl: CACHE_TTL_SECONDS,
    });
  }

  remove(slug: string): Promise<void> {
    return this.runtimeCache.delete(this.key(slug));
  }

  private async read(key: string): Promise<Nanobook | null> {
    try {
      const value = await this.runtimeCache.get(key);
      if (value === null) return null;
      const nanobook = fromNanobookSnapshot(value);
      if (nanobook) return nanobook;
      await this.runtimeCache.delete(key);
    } catch {
      return null;
    }
    return null;
  }

  private key(slug: string): string {
    return `slug:${this.normalizeSlug(slug)}`;
  }

  private normalizeSlug(slug: string): string {
    return slug.trim().toLowerCase();
  }
}
