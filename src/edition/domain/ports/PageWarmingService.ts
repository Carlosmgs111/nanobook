import type { Result } from "../../../shared/domain/Result";
import type { EditionStorageError } from "../errors";

export interface PageWarmingService {
  warm(href: string): Promise<Result<EditionStorageError, void>>;
}
