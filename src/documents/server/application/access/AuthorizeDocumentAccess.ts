import type { Document } from "../../domain/Document";
import type { AccessDecision, DocumentAccessPolicy } from "../../domain/access/DocumentAccessPolicy";
import type { AccessGrantCodec, DocumentAccessRepository } from "../../domain/access/ports";

export interface AuthorizeDocumentAccessInput {
  /** The proxy chain: the stored document and, when different, the resolved one. */
  documents: Array<Document | null | undefined>;
  canWrite: boolean;
  /** Token the viewer presented for a document, if any. How it travels is the caller's concern. */
  grantFor: (documentId: string) => string | undefined;
}

/** Returns the protected links of a chain, deduplicated by identity. */
export function securedDocuments(documents: Array<Document | null | undefined>): Document[] {
  const seen = new Set<string>();
  const secured: Document[] = [];
  for (const document of documents) {
    if (!document || document.getMetadata().secured !== true) continue;
    const id = document.getDocumentId().getValue();
    if (seen.has(id)) continue;
    seen.add(id);
    secured.push(document);
  }
  return secured;
}

export class AuthorizeDocumentAccess {
  constructor(
    private readonly accessRepository: DocumentAccessRepository,
    private readonly codec: AccessGrantCodec,
    private readonly policy: DocumentAccessPolicy,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute({ documents, canWrite, grantFor }: AuthorizeDocumentAccessInput): Promise<AccessDecision> {
    const secured = securedDocuments(documents);
    if (secured.length === 0 || canWrite) {
      return this.policy.evaluate({ secured: secured.length > 0, canWrite, hasValidGrant: false });
    }

    for (const document of secured) {
      const documentId = document.getDocumentId().getValue();
      const hasValidGrant = await this.hasValidGrant(documentId, grantFor(documentId));
      const decision = this.policy.evaluate({ secured: true, canWrite: false, hasValidGrant });
      if (decision.kind === "challenge") return decision;
    }
    return { kind: "allow" };
  }

  private async hasValidGrant(documentId: string, token: string | undefined): Promise<boolean> {
    if (!token) return false;

    const record = await this.accessRepository.get(documentId);
    // A failing lookup or a missing/cleared hash never grants access.
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
