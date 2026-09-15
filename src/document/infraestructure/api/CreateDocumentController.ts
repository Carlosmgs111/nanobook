import type { APIRoute } from "astro";
import type { CreateDocument } from "../../application/CreateDocument";
import { jsonResponse, handleServiceError } from "./utils";
import type { CreateDocumentRequest } from "./dto/CreateDocumentRequest";
import { toDocumentInput } from "./mappers/toDocumentInput";
import { toDocumentResponse } from "./mappers/toDocumentResponse";

export class CreateDocumentController {
  constructor(private createDocument: CreateDocument) {}
  handle: APIRoute = async ({ request }) => {
    try {
      const payload: CreateDocumentRequest = await request.json();
      console.log({ payload });

      const result = await this.createDocument.execute(toDocumentInput(payload));

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
