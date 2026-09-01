import type { ContentService as ContentServicePort } from "../../application/ContentService.port";
import { contentRepository } from "../../../document/_index";
import type { Document } from "../../../document/_domain/types";
import type { Heading, DocumentSource } from "../../../document/_domain/parse";
import { parseDocument } from "../../../document/_index";
import { computeContentHash } from "../../../document/_domain/hash";

export class ContentService implements ContentServicePort {
  async getDocument(slug: string): Promise<Document | null> {
    return await contentRepository.getBySlug(slug);
  }
  parseDocument(content: DocumentSource): { headings: Heading[] } {
    return parseDocument(content);
  }
  computeContentHash(content: Document): string {
    return computeContentHash(content);
  }
}
