import type { APIRoute } from "astro";
import type { DeleteDocument } from "../../application/DeleteDocument";
import { handleServiceError, jsonResponse } from "./utils";

export class DeleteDocumentController {
  constructor(private deleteDocument: DeleteDocument) {}

  handle: APIRoute = async ({ params }) => {
    try {
      const { slug: documentId } = params;
      if (!documentId) return jsonResponse({ error: "Falta el parámetro id" }, 400);
      const result = await this.deleteDocument.execute(documentId);
      if (!result.isSuccess) return handleServiceError(result.getError());
      return jsonResponse({ ok: true }, 200);
    } catch (error) {
      console.error(error);
      return jsonResponse({ error: "Error interno del servidor" }, 500);
    }
  };
}
