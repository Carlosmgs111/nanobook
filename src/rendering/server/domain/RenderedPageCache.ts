import type { Result } from "../../../shared/domain/Result";
import { InfrastructureError } from "../../../shared/errors";

export class PageCacheError extends InfrastructureError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PageCacheError";
  }
}

export interface CachedPage {
  pageId: string;
  contentHash: string;
  html: string;
  renderedAt: string;
}

/** Puerto: guarda el HTML ya renderizado de cada página; `contentHash` decide si sigue siendo válido. */
export interface RenderedPageCache {
  get(pageId: string, contentHash: string): Promise<CachedPage | null>;
  set(pageId: string, contentHash: string, html: string): Promise<void>;
  invalidate(pageIds: string[]): Promise<Result<PageCacheError, void>>;
}
