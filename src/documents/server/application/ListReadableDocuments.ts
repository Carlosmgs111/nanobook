import type { Document } from "../domain/Document";
import type { ContentRepository } from "../domain/ports/ContentRepository";
import type { WriteAccess } from "../domain/ports/WriteAccess";
import { securedDocuments } from "./access/AuthorizeDocumentAccess";
import { canWrite } from "./canWrite";
import type { ProxyParser } from "./ProxyParser";

/** Lista los documentos para un lector sin desafío posible (un agente): los protegidos salen redactados salvo para escritores. */
export class ListReadableDocuments {
  constructor(
    private readonly repository: ContentRepository,
    private readonly proxyParser: ProxyParser,
    private readonly writeAccess: WriteAccess,
  ) {}

  async execute(nanobookId: string, { userId }: { userId: string | undefined }): Promise<Document[]> {
    const listed = await this.repository.list(nanobookId);
    if (!listed.isSuccess) return [];

    const raw = listed.getValue();
    const resolved = await this.proxyParser.parseProxies(nanobookId, raw);
    if (await canWrite(this.writeAccess, nanobookId, userId)) return resolved;

    return resolved.map((document, index) =>
      securedDocuments([raw[index], document]).length > 0 ? raw[index].redacted() : document,
    );
  }
}
