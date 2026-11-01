import type { Result } from "../../../shared/domain/Result";
import type { Document } from "../domain/Document";
import type { ContentRepositoryListError } from "../domain/ports/ContentRepository";

export interface DocumentSourceCache {
  getOrLoad(
    nanobookId: string,
    publicPath: string,
    load: () => Promise<Result<ContentRepositoryListError, Document | null>>,
  ): Promise<Result<ContentRepositoryListError, Document | null>>;
  invalidateNanobook(nanobookId: string): Promise<void>;
}
