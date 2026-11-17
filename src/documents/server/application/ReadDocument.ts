import { Subject, type Authorizer } from "../../../authorization/server";
import type { Document } from "../domain/Document";
import { documentResource, securedDocuments } from "./access/documentResource";
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
  /** `via` indica si el documento estaba abierto o protegido (y el lector superó la protección). */
  | { kind: "allowed"; document: Document; via: "open" | "protected" }
  /** `document` va redactado: sin cuerpo ni descripción. */
  | { kind: "challenge"; method: "password"; document: Document };

/**
 * Único punto de lectura que aplica la protección por contraseña: no se obtiene contenido protegido
 * sin superar el desafío.
 *
 * Contrato de seguridad: este caso de uso **no** autoriza el acceso al nanobook para los documentos
 * abiertos. Quien lo llama debe haber autorizado antes la lectura del nanobook (`resolveNanobookRoute`
 * en las páginas, `authorizer.require` en `AgentToolService`). Solo los documentos con enlaces
 * protegidos pasan por el `Authorizer`. Puede lanzar `AccessCheckFailedError`.
 */
export class ReadDocument {
  constructor(
    private readonly getDocument: Pick<GetDocument, "executeChain">,
    private readonly authorizer: Authorizer,
  ) {}

  async execute({ nanobookId, path, viewer, observeTiming }: ReadDocumentInput): Promise<ReadDocumentResult> {
    const chain = await this.getDocument.executeChain(nanobookId, path, observeTiming);
    if (!chain) return { kind: "not-found" };

    // Sin enlaces protegidos no hay nada que decidir aquí: quien llama ya autorizó el acceso al nanobook.
    if (securedDocuments([chain.raw, chain.resolved]).length === 0) {
      return { kind: "allowed", document: chain.resolved, via: "open" };
    }

    const decision = await this.authorizer.authorize({
      subject: Subject.of(viewer.userId, viewer.grantFor),
      action: "read",
      resource: documentResource(nanobookId, chain.raw, chain.resolved),
    });
    if (decision.effect === "allow") return { kind: "allowed", document: chain.resolved, via: "protected" };
    if (decision.effect === "challenge") {
      return { kind: "challenge", method: decision.kind, document: chain.raw.redacted() };
    }
    return { kind: "not-found" };
  }
}
