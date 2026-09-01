import type {
  Crumb,
  NavigationNode,
  ParentEntry,
} from "../../navigation/domain/types";
import type { Heading } from "../../document/parse/document";
import type { Document } from "../../document/_domain/types";

export interface RenderedDocument {
  Content: any;
}

export interface DocumentRenderer {
  render(document: { id: string; content: string }): Promise<RenderedDocument>;
}

export interface RenderedPageData {
  pageId: string;
  document: Document;
  renderedBody: string;
  breadcrumbs: Crumb[];
  sidebarEntries: NavigationNode[];
  parentEntry: ParentEntry | null;
  childEntries: NavigationNode[];
}

export interface RenderedDocumentPage {
  rendered: RenderedPageData;
  headings: Heading[];
  contentHash: string;
}
