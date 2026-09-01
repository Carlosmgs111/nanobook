import type { Document } from "../domain/Document";
import type { ContentRepository } from "../domain/types";
import type { ProxyParser } from "./ProxyParser";

export class GetAllDocuments {
  constructor(
    private repository: ContentRepository,
    private proxyResolver: ProxyParser
  ) {}

  async execute(): Promise<Document[]> {
    const documents = await this.repository.list();
    const allDocuments = await this.proxyResolver.parseProxies(documents);
    return allDocuments;
  }
}
