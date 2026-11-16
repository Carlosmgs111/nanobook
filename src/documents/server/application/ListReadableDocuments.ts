import type { Document } from "../domain/Document";
import type { ContentRepository } from "../domain/ports/ContentRepository";
import type { WriteAccess } from "../domain/ports/WriteAccess";
import { securedDocuments } from "./access/AuthorizeDocumentAccess";
import type { ProxyParser } from "./ProxyParser";

/**
 * Lista los documentos de un nanobook para un lector sin desafío posible
 * (por ejemplo un agente): los protegidos se devuelven redactados salvo para
 * quien puede escribir en el nanobook.
 */
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
    // Un fallo al consultar el puerto cuenta como «no escritor».
    const canWrite = userId !== undefined && (await this.writeAccess.require(nanobookId, userId)).isSuccess;
    if (canWrite) return resolved;

    return resolved.map((document, index) =>
      securedDocuments([raw[index], document]).length > 0 ? raw[index].redacted() : document,
    );
  }
}
