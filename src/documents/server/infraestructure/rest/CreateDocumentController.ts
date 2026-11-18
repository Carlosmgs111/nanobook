import type { CreateDocument } from "../../application/CreateDocument";
import type { CreateDocumentRequest } from "../../application/dto/CreateDocumentRequest";
import { serializeEntry } from "../../application/dto/SerializedEntry";
import { documentMutationRoute, handleServiceError, jsonResponse } from "./utils";
import { toDocumentInput } from "./mappers/toDocumentInput";

export class CreateDocumentController {
  constructor(private createDocument: CreateDocument) {}

  handle = documentMutationRoute(async ({ nanobookId, documentId, actorId, request }) => {
    const payload: CreateDocumentRequest = await request.json();
    if (!payload.id || !payload.path) {
      return jsonResponse({ error: "El id y el path son obligatorios" }, 400);
    }
    if (payload.id !== documentId) {
      return jsonResponse({ error: "El parámetro id no coincide con el id del documento" }, 400);
    }

    const result = await this.createDocument.execute(
      nanobookId,
      toDocumentInput(documentId, payload),
      actorId,
    );
    if (!result.isSuccess) return handleServiceError(result.getError());
    return jsonResponse(serializeEntry(result.getValue().parse()), 201);
  });
}
