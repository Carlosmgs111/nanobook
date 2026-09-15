import type { Document } from "../Document";
import type { Heading } from "../Heading";

export interface DocumentParser {
  parseDocument(document: Document): { headings: Heading[] };
}
