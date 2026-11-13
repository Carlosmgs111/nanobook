import type { Heading } from "../../../documents/server/domain/Heading";
import type { Entry } from "../../../documents/server/domain/types";

export interface RenderedDocument {
  Content: any;
}

/** Puerto: lo que publicación necesita para convertir Markdown en HTML; lo aporta el compositor. */
export interface MarkdownEngine {
  readonly fingerprint: string;
  render(source: string): Promise<string>;
}

export interface DocumentRenderer {
  readonly fingerprint: string;
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
