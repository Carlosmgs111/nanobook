import type { APIRoute } from "astro";
import type { UpdateDocument } from "../../application/UpdateDocument";
import { jsonResponse, handleServiceError } from "./utils";
import type { UpdateDocumentRequest } from "./dto/UpdateDocumentRequest";
import { toDocumentInput } from "./mappers/toDocumentInput";

export class UpdateDocumentController {
  constructor(private updateDocument: UpdateDocument) {}
  handle: APIRoute = async ({ params, request }) => {
    try {
      const { slug } = params;
      if (!slug) {
        return jsonResponse({ error: "Falta el parámetro slug" }, 400);
      }

      const payload: UpdateDocumentRequest = JSON.parse(await request.text());

      if (payload.id !== slug) {
        return jsonResponse(
          { error: "El slug no coincide con el id del documento" },
          400
        );
      }

      const result = await this.updateDocument.execute(toDocumentInput(payload));
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
