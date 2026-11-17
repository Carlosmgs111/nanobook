import type { Document } from "../../domain/Document";
import type { AccessGrantCodec, DocumentAccessRepository } from "../../domain/access/ports";
import { securedDocuments } from "./documentResource";

export { securedDocuments };

export type AccessDecision = { kind: "allow" } | { kind: "challenge"; method: "password" };

export interface AuthorizeDocumentAccessInput {
  /** La cadena de proxies: el documento almacenado y, si difiere, el resuelto. */
  documents: Array<Document | null | undefined>;
  canWrite: boolean;
  /** Token que el lector presentó para un documento, si lo hay. */
  grantFor: (documentId: string) => string | undefined;
}

export class AuthorizeDocumentAccess {
  constructor(
    private readonly accessRepository: DocumentAccessRepository,
    private readonly codec: AccessGrantCodec,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute({ documents, canWrite, grantFor }: AuthorizeDocumentAccessInput): Promise<AccessDecision> {
    const secured = securedDocuments(documents);
    // Sin eslabones protegidos, o con permiso de escritura, no hay desafío.
    if (secured.length === 0 || canWrite) return { kind: "allow" };

    // Cada eslabón protegido de la cadena exige su propio grant válido.
    for (const document of secured) {
      const documentId = document.getDocumentId().getValue();
      if (!(await this.hasValidGrant(documentId, grantFor(documentId)))) {
        return { kind: "challenge", method: "password" };
      }
    }
    return { kind: "allow" };
  }

  private async hasValidGrant(documentId: string, token: string | undefined): Promise<boolean> {
    if (!token) return false;

    const record = await this.accessRepository.get(documentId);
    // Un fallo de lectura o un hash ausente nunca concede acceso.
    if (!record.isSuccess) return false;
    const value = record.getValue();
    if (!value || value.passwordHash === null) return false;

    return this.codec.verify(token, {
      documentId,
      passwordVersion: value.passwordVersion,
      now: this.clock(),
    });
  }
}
