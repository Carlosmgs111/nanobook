import type { APIRoute } from "astro";
import type { UpdateDocument } from "../../application/UpdateDocument";
import { jsonResponse, handleServiceError } from "./utils";
import type { UpdateDocumentRequest } from "./dto/UpdateDocumentRequest";
import { toDocumentInput } from "./mappers/toDocumentInput";
import type { DocumentInput } from "../../application/dto/DocumentInput";
import { toDocumentResponse } from "./mappers/toDocumentResponse";

export class UpdateDocumentController {
  constructor(private updateDocument: UpdateDocument) {}
  handle: APIRoute = async ({ params, request, locals }) => {
    try {
      const { id, nanobookId } = params;
      if (!id) {
        return jsonResponse({ error: "Falta el parámetro id" }, 400);
      }
      if (!nanobookId) {
        return jsonResponse({ error: "Falta el parámetro nanobookId" }, 400);
      }

      const payload: UpdateDocumentRequest = JSON.parse(await request.text());

      if (!payload.path) {
        return jsonResponse({ error: "El path es obligatorio" }, 400);
      }
      if (!locals.currentUserId) {
        return jsonResponse({ error: "Autenticación requerida" }, 401);
      }

      const result = await this.updateDocument.execute(nanobookId, {
        ...toDocumentInput(payload),
        // The route is the sole external source of identity for updates.
        id,
      } as DocumentInput, locals.currentUserId);
      if (!result.isSuccess) {
        return handleServiceError(result.getError());
      }

      return jsonResponse(toDocumentResponse(result.getValue().parse()), 200);
    } catch (error) {
      console.error(error);
      return jsonResponse({ error: "Error interno del servidor" }, 500);
    }
  };
}
