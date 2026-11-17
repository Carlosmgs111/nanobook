import type { CreateDocumentRequest } from "../../../application/dto/CreateDocumentRequest";
import type { UpdateDocumentRequest } from "../../../application/dto/UpdateDocumentRequest";
import type { DocumentInput } from "../../../application/dto/DocumentInput";

/** Copia solo los campos editables; la identidad llega de la ruta y la auditoría la fija el servidor. */
export function toDocumentInput(
  id: string,
  request: CreateDocumentRequest | UpdateDocumentRequest,
): DocumentInput {
  const expectedRevision = "expectedRevision" in request ? request.expectedRevision : undefined;
  return {
    id,
    ...(typeof expectedRevision === "number" ? { expectedRevision } : {}),
    path: request.path,
    title: request.title,
    description: request.description,
    content: request.content,
    author: request.author,
    cover: request.cover,
    tags: request.tags,
    draft: request.draft,
    position: request.position,
    ref: request.ref,
  };
}
