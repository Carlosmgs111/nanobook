import type { Heading } from "../../document/parse/document";

export interface RenderedDocument {
  Content: any;
  headings: Heading[];
}

export interface DocumentRenderer {
  render(document: { id: string; content: string }): Promise<RenderedDocument>;
}

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
