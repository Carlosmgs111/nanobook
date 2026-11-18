import { Subject, type Authorizer } from "../../../authorization/server";
import type { Document } from "../domain/Document";
import type { ContentRepository } from "../domain/ports/ContentRepository";
import { documentResource, securedDocuments } from "./access/documentResource";
import type { ProxyParser } from "./ProxyParser";

/**
 * Lista los documentos para un lector sin desafío posible (un agente): los protegidos salen redactados salvo para escritores.
 *
 * Contrato de seguridad: este caso de uso **no** autoriza el acceso al nanobook para los documentos
 * abiertos. Quien lo llama debe haber autorizado antes la lectura del nanobook (`resolveNanobookRoute`
 * en las páginas, `authorizer.require` en `AgentToolService`). Solo los documentos con enlaces
 * protegidos pasan por el `Authorizer`. Puede lanzar `AccessCheckFailedError`.
 */
export class ListReadableDocuments {
  constructor(
    private readonly repository: ContentRepository,
    private readonly proxyParser: ProxyParser,
    private readonly authorizer: Authorizer,
  ) {}

  async execute(nanobookId: string, { userId }: { userId: string | undefined }): Promise<Document[]> {
    const listed = await this.repository.list(nanobookId);
    if (!listed.isSuccess) return [];

    const raw = listed.getValue();
    const resolved = await this.proxyParser.parseProxies(nanobookId, raw);
    const subject = Subject.of(userId);

    const readable = await Promise.all(
      resolved.map(async (document, index): Promise<Document | null> => {
        if (securedDocuments([raw[index], document]).length === 0) return document;
        const decision = await this.authorizer.authorize({
          subject,
          action: "read",
          resource: documentResource(nanobookId, raw[index], document),
        });
        if (decision.effect === "allow") return document;
        return decision.effect === "challenge" ? raw[index].redacted() : null;
      }),
    );
    return readable.filter((document): document is Document => document !== null);
  }
}
