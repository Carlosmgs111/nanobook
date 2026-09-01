import type { Document } from "../../document/_domain/types";
import type { Heading, DocumentSource } from "../../document/_domain/parse";

export interface ContentService {
  getDocument(slug: string): Promise<Document | null>;
  parseDocument(content: DocumentSource): { headings: Heading[] };
  computeContentHash(content: Document): string;
}
