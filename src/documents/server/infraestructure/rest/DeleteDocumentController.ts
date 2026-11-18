import type { DeleteDocument } from "../../application/DeleteDocument";
import { documentMutationRoute, handleServiceError, jsonResponse } from "./utils";

export class DeleteDocumentController {
  constructor(private deleteDocument: DeleteDocument) {}

  handle = documentMutationRoute(async ({ nanobookId, documentId, actorId }) => {
    const result = await this.deleteDocument.execute(nanobookId, documentId, actorId);
    if (!result.isSuccess) return handleServiceError(result.getError());
    return jsonResponse({ ok: true }, 200);
  });
}
