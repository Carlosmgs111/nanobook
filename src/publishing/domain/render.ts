import type { Heading } from "../../document/domain/Document";
import type { Document } from "../../document/domain/Document";

export interface RenderedDocument {
  Content: any;
}

export interface DocumentRenderer {
  render(document: Document): Promise<RenderedDocument>;
}

export interface RenderedPageData {
  pageId: string;
  document: Document;
  renderedBody: string;
}

export interface RenderedDocumentPage {
  rendered: RenderedPageData;
  headings: Heading[];
  contentHash: string;
}
