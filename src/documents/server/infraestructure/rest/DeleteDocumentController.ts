import type { APIRoute } from "astro";
import type { DeleteDocument } from "../../application/DeleteDocument";
import { handleServiceError, jsonResponse } from "./utils";

export class DeleteDocumentController {
  constructor(private deleteDocument: DeleteDocument) {}

  handle: APIRoute = async ({ params, locals }) => {
    try {
      const { slug: documentId, nanobookId } = params;
      if (!documentId) return jsonResponse({ error: "Falta el parámetro id" }, 400);
      if (!nanobookId) return jsonResponse({ error: "Falta el parámetro nanobookId" }, 400);
      if (!locals.currentUserId) {
        return jsonResponse({ error: "Autenticación requerida" }, 401);
      }
      const result = await this.deleteDocument.execute(
        nanobookId,
        documentId,
        locals.currentUserId,
      );
      if (!result.isSuccess) return handleServiceError(result.getError());
      return jsonResponse({ ok: true }, 200);
    } catch (error) {
      console.error(error);
      return jsonResponse({ error: "Error interno del servidor" }, 500);
    }
  };
}
