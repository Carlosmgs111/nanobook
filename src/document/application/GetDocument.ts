import type { Document } from "../domain/Document";
import type { ContentRepository } from "../domain/ports/ContentRepository";
import type { ProxyParser } from "./ProxyParser";

export class GetDocument {
  constructor(
    private contentRepository: ContentRepository,
    private parseProxy: ProxyParser
  ) {}

  async execute(documentId: string): Promise<Document | null> {
    const documentResult = this.contentRepository.getByPath
      ? await this.contentRepository.getByPath(documentId)
      : await this.contentRepository.getById(documentId);
    if (!documentResult.isSuccess) {
      return null;
    }

    const document = documentResult.getValue();
    if (!document) return null;
    return (await this.parseProxy.parseProxies([document]))[0];
  }
}
