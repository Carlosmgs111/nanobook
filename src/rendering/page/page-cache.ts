export interface CachedPage {
  pageId: string;
  contentHash: string;
  html: string;
  renderedAt: string;
}

export interface RenderedPageCache {
  get(pageId: string, contentHash: string): Promise<CachedPage | null>;
  set(pageId: string, contentHash: string, html: string): Promise<void>;
  invalidate(pageIds: string[]): Promise<void>;
}
