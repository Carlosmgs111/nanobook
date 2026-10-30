import type { Document } from "../domain/Document";
import type { ContentRepository } from "../domain/ports/ContentRepository";
import type { ProxyParser } from "./ProxyParser";

export class GetAllDocuments {
  constructor(
    private repository: ContentRepository,
    private proxyResolver: ProxyParser
  ) {}

  async execute(nanobookId: string): Promise<Document[]> {
    const documentsResult = await this.repository.list(nanobookId);
    if (!documentsResult.isSuccess) {
      return [];
    }
    const documents = documentsResult.getValue();
    const allDocuments = await this.proxyResolver.parseProxies(nanobookId, documents);
    return allDocuments;
  }

  async refresh(nanobookId: string): Promise<Document[]> {
    return this.execute(nanobookId);
  }
}
