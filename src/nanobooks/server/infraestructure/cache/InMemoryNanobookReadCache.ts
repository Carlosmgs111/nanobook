import { Result } from "../../../../shared/domain/Result";
import type { NanobookReadCache } from "../../application/NanobookReadCache";
import type { Nanobook } from "../../domain/Nanobook";
import {
  fromNanobookSnapshot,
  toNanobookSnapshot,
  type NanobookSnapshot,
} from "../../domain/NanobookSnapshot";
import type { NanobookRepositoryFailure } from "../../domain/ports/NanobookRepository";

export class InMemoryNanobookReadCache implements NanobookReadCache {
  private readonly entries = new Map<string, NanobookSnapshot>();

  async getOrLoad(
    slug: string,
    load: () => Promise<Result<NanobookRepositoryFailure, Nanobook | null>>,
  ): Promise<Result<NanobookRepositoryFailure, Nanobook | null>> {
    const key = this.key(slug);
    const cached = this.entries.get(key);
    if (cached) {
      const nanobook = fromNanobookSnapshot(cached);
      if (nanobook) return Result.ok(nanobook);
      this.entries.delete(key);
    }

    const result = await load();
    if (result.isSuccess && result.getValue()) {
      this.entries.set(key, toNanobookSnapshot(result.getValue()));
    }
    return result;
  }

  async replace(nanobook: Nanobook, previousSlug?: string): Promise<void> {
    const currentKey = this.key(nanobook.getSlug());
    if (previousSlug && this.key(previousSlug) !== currentKey) {
      this.entries.delete(this.key(previousSlug));
    }
    this.entries.set(currentKey, toNanobookSnapshot(nanobook));
  }

  async remove(slug: string): Promise<void> {
    this.entries.delete(this.key(slug));
  }

  private key(slug: string): string {
    return `slug:${slug.trim().toLowerCase()}`;
  }
}
