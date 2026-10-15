import type { Document } from "../domain/Document";
import type { ContentRepository } from "../domain/ports/ContentRepository";
import type { ProxyParser } from "./ProxyParser";
import { DocumentPath } from "../domain/DocumentPath";

export class GetDocument {
  constructor(
    private contentRepository: ContentRepository,
    private parseProxy: ProxyParser
  ) {}

  async execute(nanobookId: string, documentPathValue: string): Promise<Document | null> {
    const document = await this.executeRaw(nanobookId, documentPathValue);
    if (!document) return null;
    return (await this.parseProxy.parseProxies(nanobookId, [document]))[0];
  }

  async executeRaw(nanobookId: string, documentPathValue: string): Promise<Document | null> {
    const pathResult = DocumentPath.create(documentPathValue);
    if (!pathResult.isSuccess) return null;

    const documentResult = await this.contentRepository.getByPublicPath(
      nanobookId,
      pathResult.getValue().getPublicValue()
    );
    if (!documentResult.isSuccess) {
      return null;
    }

    const document = documentResult.getValue();
    if (!document) return null;
    return document;
  }
}
