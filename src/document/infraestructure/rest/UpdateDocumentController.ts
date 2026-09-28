import type { APIRoute } from "astro";
import type { UpdateDocument } from "../../application/UpdateDocument";
import { jsonResponse, handleServiceError } from "./utils";
import type { UpdateDocumentRequest } from "./dto/UpdateDocumentRequest";
import { toDocumentInput } from "./mappers/toDocumentInput";
import type { DocumentInput } from "../../application/dto/DocumentInput";

export class UpdateDocumentController {
  constructor(private updateDocument: UpdateDocument) {}
  handle: APIRoute = async ({ params, request }) => {
    try {
      const { slug: id } = params;
      if (!id) {
        return jsonResponse({ error: "Falta el parámetro id" }, 400);
      }

      const payload: UpdateDocumentRequest = JSON.parse(await request.text());

      if (!payload.path) {
        return jsonResponse({ error: "El path es obligatorio" }, 400);
      }

      const result = await this.updateDocument.execute({
        ...toDocumentInput(payload),
        // The route is the sole external source of identity for updates.
        id,
      } as DocumentInput);
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
