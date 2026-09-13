import type { Document } from "../domain/Document";
import type { ContentRepository } from "../domain/types";
import type { DocumentId } from "../domain/DocumentId";
import type { ProxyParser } from "./ProxyParser";

export class GetDocument {
  constructor(
    private contentRepository: ContentRepository,
    private parseProxy: ProxyParser
  ) {}

  async execute(documentId: string | DocumentId): Promise<Document | null> {
    const documentResult =
      typeof documentId === "string"
        ? await this.contentRepository.getBySlug(documentId)
        : await this.contentRepository.get(documentId);

    if (!documentResult.isSuccess) {
      return null;
    }

    const document = documentResult.getValue();
    if (!document) return null;
    return (await this.parseProxy.parseProxies([document]))[0];
  }
}
