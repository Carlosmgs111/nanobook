import type { Document } from "../domain/Document";
import type { WriteAccess } from "../domain/ports/WriteAccess";
import { securedDocuments, type AuthorizeDocumentAccess } from "./access/AuthorizeDocumentAccess";
import { canWrite } from "./canWrite";
import type { DocumentTimingObserver, GetDocument } from "./GetDocument";

/** Quién lee: su identidad (si la hay) y la prueba de acceso que presenta. */
export interface DocumentViewer {
  /** Solo se invoca si la cadena tiene un enlace protegido, para no leer la sesión en lecturas públicas. */
  userId(): Promise<string | undefined>;
  /** Token presentado para un documento; cómo viaja (cookie) es asunto del llamador. */
  grantFor(documentId: string): string | undefined;
}

export interface ReadDocumentInput {
  nanobookId: string;
  path: string;
  viewer: DocumentViewer;
  observeTiming?: DocumentTimingObserver;
}

export type ReadDocumentResult =
  | { kind: "not-found" }
  /** `via` indica por qué se concedió: documento abierto, escritor del nanobook o grant válido. */
  | { kind: "allowed"; document: Document; via: "open" | "writer" | "grant" }
  /** `document` va redactado: sin cuerpo ni descripción. */
  | { kind: "challenge"; method: "password"; document: Document };

/** Único punto de lectura que aplica la protección: no se obtiene contenido protegido sin superar el desafío. */
export class ReadDocument {
  constructor(
    private readonly getDocument: Pick<GetDocument, "executeChain">,
    private readonly authorize: Pick<AuthorizeDocumentAccess, "execute">,
    private readonly writeAccess: WriteAccess,
  ) {}

  async execute({ nanobookId, path, viewer, observeTiming }: ReadDocumentInput): Promise<ReadDocumentResult> {
    const chain = await this.getDocument.executeChain(nanobookId, path, observeTiming);
    if (!chain) return { kind: "not-found" };

    const documents = [chain.raw, chain.resolved];
    if (securedDocuments(documents).length === 0) {
      return { kind: "allowed", document: chain.resolved, via: "open" };
    }

    const writer = await canWrite(this.writeAccess, nanobookId, await viewer.userId());
    const decision = await this.authorize.execute({ documents, canWrite: writer, grantFor: viewer.grantFor });
    if (decision.kind === "challenge") {
      return { kind: "challenge", method: decision.method, document: chain.raw.redacted() };
    }
    return { kind: "allowed", document: chain.resolved, via: writer ? "writer" : "grant" };
  }
}
