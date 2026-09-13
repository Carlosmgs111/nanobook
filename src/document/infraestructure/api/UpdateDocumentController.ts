import type { APIRoute } from "astro";
import type {
  UpdateDocument,
} from "../../application/UpdateDocument";
import { jsonResponse, handleServiceError } from "./utils";
import type { DocumentInput } from "../../domain/types";

export class UpdateDocumentController {
  constructor(private updateDocument: UpdateDocument) {}
  handle: APIRoute = async ({ params, request }) => {
    try {
      const { slug } = params;
      if (!slug) {
        return jsonResponse({ error: "Falta el parámetro slug" }, 400);
      }

      const document: DocumentInput = JSON.parse(await request.text());

      if (document.id !== slug) {
        return jsonResponse(
          { error: "El slug no coincide con el id del documento" },
          400
        );
      }

      const result = await this.updateDocument.execute(document);
      if (!result.isSuccess) {
        return handleServiceError(result.getError());
      }

      return jsonResponse({ ok: true }, 200);
    } catch (error) {
      console.error(error);
      return jsonResponse({ error: "Error interno del servidor" }, 500);
    }
  };
}
