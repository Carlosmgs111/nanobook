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
    let document;
    if (typeof documentId === "string") {
      document = await this.contentRepository.getBySlug(documentId);
    } else {
      document = await this.contentRepository.get(documentId);
    }
    if (!document) return null;
    return (await this.parseProxy.parseProxies([document]))[0];
  }
}
