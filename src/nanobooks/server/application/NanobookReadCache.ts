import type { Result } from "../../../shared/domain/Result";
import type { Nanobook } from "../domain/Nanobook";
import type { NanobookRepositoryFailure } from "../domain/ports/NanobookRepository";

export interface NanobookReadCache {
  getOrLoad(
    slug: string,
    load: () => Promise<Result<NanobookRepositoryFailure, Nanobook | null>>,
  ): Promise<Result<NanobookRepositoryFailure, Nanobook | null>>;
  replace(nanobook: Nanobook, previousSlug?: string): Promise<void>;
  remove(slug: string): Promise<void>;
}
