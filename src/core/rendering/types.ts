import type { Heading } from "../../lib/document";

export interface RenderedDocument {
  Content: any;
  headings: Heading[];
}

export interface DocumentRenderer {
  render(document: { id: string; content: string }): Promise<RenderedDocument>;
}
