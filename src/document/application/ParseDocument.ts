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
    const documentIdResult = DocumentId.create(id);
    if (!documentIdResult.isSuccess) return null;
    const documentResult = await this.contentRepository.get(
      documentIdResult.getValue()
    );
    if (!documentResult.isSuccess) return null;
    const document = documentResult.getValue();
    if (!document) return null;
    return this.documentParser.parseDocument(document);
  }
}
