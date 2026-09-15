import type { CreateDocumentRequest } from "../../../application/dto/CreateDocumentRequest";
import type { UpdateDocumentRequest } from "../../../application/dto/UpdateDocumentRequest";
import type { DocumentInput } from "../../../application/dto/DocumentInput";

export function toDocumentInput(
  request: CreateDocumentRequest | UpdateDocumentRequest
): DocumentInput {
  return {
    ...request,
    date: new Date(request.date),
  };
}
