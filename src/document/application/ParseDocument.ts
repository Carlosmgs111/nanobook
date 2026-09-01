import type { Heading } from "../domain/Document";
import type { DocumentParser } from "../domain/DocumentParser";
import { DocumentId } from "../domain/DocumentId";
import type { ContentRepository } from "../domain/types";

export class GetParsedDocument {
  constructor(
    private documentParser: DocumentParser,
    private contentRepository: ContentRepository
  ) {}
  async execute(id: string): Promise<{ headings: Heading[] } | null> {
    const documentId = new DocumentId(id);
    const document = await this.contentRepository.get(documentId);
    if (!document) return null;
    return this.documentParser.parseDocument(document);
  }
}
