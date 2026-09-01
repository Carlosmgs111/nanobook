import type { APIRoute } from "astro";
import type { CreateDocument } from "../../application/CreateDocument";
import { jsonResponse, handleServiceError } from "./utils";
import type { DocumentInput } from "../../domain/types";

export class CreateDocumentController {
  constructor(private createDocument: CreateDocument) {}
  handle: APIRoute = async ({ request }) => {
    try {
      const payload: DocumentInput = await request.json();
      console.log({ payload });

      const result = await this.createDocument.execute({
        id: payload.id,
        title: payload.title,
        description: payload.description,
        author: payload.author,
        date: payload.date ? new Date(payload.date) : new Date(),
        index: payload.index ?? false,
        position: payload.position,
        draft: payload.draft ?? false,
        tags: payload.tags,
        content: payload.content,
      });

      if (!result.ok) {
        return handleServiceError(result.error);
      }
      return jsonResponse(result.value.parse(), 201);
    } catch (error) {
      console.error(error);
      return jsonResponse({ error: "Error interno del servidor" }, 500);
    }
  };
}
