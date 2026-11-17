import type { UpdateDocument } from "../../application/UpdateDocument";
import type { UpdateDocumentRequest } from "../../application/dto/UpdateDocumentRequest";
import { serializeEntry } from "../../application/dto/SerializedEntry";
import { documentMutationRoute, handleServiceError, jsonResponse } from "./utils";
import { toDocumentInput } from "./mappers/toDocumentInput";

export class UpdateDocumentController {
  constructor(private updateDocument: UpdateDocument) {}

  handle = documentMutationRoute(async ({ nanobookId, documentId, actorId, request }) => {
    const payload: UpdateDocumentRequest = await request.json();
    if (!payload.path) return jsonResponse({ error: "El path es obligatorio" }, 400);

    // La ruta es la única fuente de identidad en una actualización.
    const result = await this.updateDocument.execute(
      nanobookId,
      toDocumentInput(documentId, payload),
      actorId,
    );
    if (!result.isSuccess) return handleServiceError(result.getError());
    return jsonResponse(serializeEntry(result.getValue().parse()), 200);
  });
}
