import type { Resource } from "../../../../authorization/server";
import type { Document } from "../../domain/Document";

/** Los eslabones protegidos de una cadena, sin repetir. */
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

/**
 * Única forma de construir el recurso de lectura de un documento. Calcula en el servidor la
 * cadena de enlaces protegidos (el documento almacenado y, si difiere, el resuelto), de modo que
 * ningún llamador puede olvidar el destino de un proxy.
 */
export function documentResource(nanobookId: string, raw: Document, resolved: Document = raw): Resource {
  return {
    type: "document",
    id: raw.getDocumentId().getValue(),
    nanobookId,
    attributes: {
      securedIds: securedDocuments([raw, resolved]).map((document) => document.getDocumentId().getValue()),
    },
  };
}
