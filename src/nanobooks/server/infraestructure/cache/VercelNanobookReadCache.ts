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
    if (cached.hit) return Result.ok(cached.value);

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
    const keys = new Set([currentKey]);
    if (previousSlug) {
      keys.add(this.key(previousSlug));
    }
    await Promise.all([...keys].map((key) => this.runtimeCache.delete(key)));
    await this.runtimeCache.set(currentKey, toNanobookSnapshot(nanobook), {
      name: `nanobook:${nanobook.getSlug()}`,
      ttl: CACHE_TTL_SECONDS,
    });
  }

  async remove(slug: string): Promise<void> {
    const key = this.key(slug);
    try {
      await this.runtimeCache.delete(key);
    } catch {
      await this.runtimeCache.set(key, { deleted: true }, {
        name: `nanobook-deleted:${this.normalizeSlug(slug)}`,
        ttl: CACHE_TTL_SECONDS,
      });
    }
  }

  private async read(key: string): Promise<{ hit: boolean; value: Nanobook | null }> {
    try {
      const value = await this.runtimeCache.get(key);
      if (value === null) return { hit: false, value: null };
      if (isDeletionTombstone(value)) return { hit: true, value: null };
      const nanobook = fromNanobookSnapshot(value);
      if (nanobook) return { hit: true, value: nanobook };
      await this.runtimeCache.delete(key);
    } catch {
      return { hit: false, value: null };
    }
    return { hit: false, value: null };
  }

  private key(slug: string): string {
    return `slug:${this.normalizeSlug(slug)}`;
  }

  private normalizeSlug(slug: string): string {
    return slug.trim().toLowerCase();
  }
}

function isDeletionTombstone(value: unknown): value is { deleted: true } {
  return !!value && typeof value === "object" && (value as { deleted?: unknown }).deleted === true;
}
