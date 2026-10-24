import type { APIRoute } from "astro";
import type { CreateDocument } from "../../application/CreateDocument";
import { jsonResponse, handleServiceError } from "./utils";
import type { CreateDocumentRequest } from "./dto/CreateDocumentRequest";
import { toDocumentInput } from "./mappers/toDocumentInput";
import { toDocumentResponse } from "./mappers/toDocumentResponse";

export class CreateDocumentController {
  constructor(private createDocument: CreateDocument) {}
  handle: APIRoute = async ({ params, request, locals }) => {
    try {
      const { id, nanobookId } = params;
      if (!id) {
        return jsonResponse({ error: "Falta el parámetro id" }, 400);
      }
      if (!nanobookId) {
        return jsonResponse({ error: "Falta el parámetro nanobookId" }, 400);
      }

      const payload: CreateDocumentRequest = await request.json();
      if (!payload.id || !payload.path) {
        return jsonResponse({ error: "El id y el path son obligatorios" }, 400);
      }

      if (payload.id !== id) {
        return jsonResponse(
          { error: "El parámetro id no coincide con el id del documento" },
          400
        );
      }

      if (!locals.currentUserId) {
        return jsonResponse({ error: "Autenticación requerida" }, 401);
      }

      const result = await this.createDocument.execute(nanobookId, {
        ...toDocumentInput(payload),
        ownerId: locals.currentUserId,
      });

      if (!result.isSuccess) {
        return handleServiceError(result.getError());
      }
      return jsonResponse(toDocumentResponse(result.getValue().parse()), 201);
    } catch (error) {
      console.error(error);
      return jsonResponse({ error: "Error interno del servidor" }, 500);
    }
  };
}
