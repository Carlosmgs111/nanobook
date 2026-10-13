import type { CreateDocumentRequest } from "../../../application/dto/CreateDocumentRequest";
import type { UpdateDocumentRequest } from "../../../application/dto/UpdateDocumentRequest";
import type { DocumentInput } from "../../../application/dto/DocumentInput";

export function toDocumentInput(
  request: CreateDocumentRequest | UpdateDocumentRequest
): DocumentInput {
  const id = "id" in request ? request.id : undefined;
  const expectedRevision = "expectedRevision" in request
    ? request.expectedRevision
    : undefined;
  return {
    ...(typeof id === "string"
      ? { id }
      : {}),
    ...(typeof expectedRevision === "number"
      ? { expectedRevision }
      : {}),
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
