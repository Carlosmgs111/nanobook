import type { ContentRepository } from "../_domain/types";
import type { CacheAdapter } from "./Cache.port";
import type { Document } from "../_domain/types";
import {
  DocumentNotFoundError,
  type DocumentServiceError,
} from "../_domain/errors";
import { err, ok, type Result } from "../../shared/utils/result";

export class UpdateDocument {
  constructor(
    private contentRepository: ContentRepository,
    private cache: CacheAdapter
  ) {}

  async execute(
    document: Document
  ): Promise<Result<void, DocumentServiceError>> {
    try {
      await this.contentRepository.update(document);
      await this.cache.invalidate([document.id]);
      return ok(undefined);
    } catch (error) {
      if (error instanceof DocumentNotFoundError) {
        return err(error);
      }
      console.error(error);
      return err(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
