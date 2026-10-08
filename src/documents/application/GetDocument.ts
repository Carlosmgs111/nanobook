import type { Document } from "../domain/Document";
import type { ContentRepository } from "../domain/ports/ContentRepository";
import type { ProxyParser } from "./ProxyParser";
import { DocumentPath } from "../domain/DocumentPath";

export class GetDocument {
  constructor(
    private contentRepository: ContentRepository,
    private parseProxy: ProxyParser
  ) {}

  async execute(documentPathValue: string): Promise<Document | null> {
    const document = await this.executeRaw(documentPathValue);
    if (!document) return null;
    return (await this.parseProxy.parseProxies([document]))[0];
  }

  async executeRaw(documentPathValue: string): Promise<Document | null> {
    const pathResult = DocumentPath.create(documentPathValue);
    if (!pathResult.isSuccess) return null;

    const documentResult = await this.contentRepository.getByPublicPath(
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
