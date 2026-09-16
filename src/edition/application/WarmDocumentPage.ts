import type { Result } from "../../shared/domain/Result";
import type { PageWarmingService } from "../domain/ports/PageWarmingService";
import type { EditionStorageError } from "../domain/errors";

export type WarmDocumentPageError = EditionStorageError;

export class WarmDocumentPage {
  constructor(private warmingService: PageWarmingService) {}

  async execute(href: string): Promise<Result<WarmDocumentPageError, void>> {
    return this.warmingService.warm(href);
  }
}
