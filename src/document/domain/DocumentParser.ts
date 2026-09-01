import type { Heading } from "./Document";
import { Document } from "./Document";

export interface DocumentParser {
  parseDocument(document: Document): { headings: Heading[] };
}
