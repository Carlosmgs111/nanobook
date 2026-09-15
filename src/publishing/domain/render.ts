import type { Heading } from "../../document/domain/Heading";
import type { Entry } from "../../document/domain/types";

export interface RenderedDocument {
  Content: any;
}

export interface DocumentRenderer {
  render(document: { getContent(): string }): Promise<RenderedDocument>;
}

export interface RenderedPageData {
  pageId: string;
  entry: Entry;
  renderedBody: string;
}

export interface RenderedDocumentPage {
  rendered: RenderedPageData;
  headings: Heading[];
  contentHash: string;
}
