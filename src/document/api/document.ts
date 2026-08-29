import type { APIRoute } from "astro";
import type { DocumentService } from "../service/document-service";
import {
  DocumentAlreadyExistsError,
  DocumentNotFoundError,
  InvalidDocumentIdError,
  ParentNotFoundError,
} from "../model/errors";
import type { Document } from "../model/types";

export const prerender = false;

export interface CreateDocumentPayload {
  id: string;
  title: string;
  description: string;
  author?: string;
  date?: string;
  index?: boolean;
  position?: number;
  draft?: boolean;
  tags?: string[];
}

export function createPatchHandler(service: DocumentService): APIRoute {
  return async ({ params, request }) => {
    try {
      const { slug } = params;
      if (!slug) {
        return jsonResponse({ error: "Falta el parámetro slug" }, 400);
      }

      const document: Document = JSON.parse(await request.text());

      if (document.id !== slug) {
        return jsonResponse(
          { error: "El slug no coincide con el id del documento" },
          400,
        );
      }

      const result = await service.update(document);
      if (!result.ok) {
        return handleServiceError(result.error);
      }

      return jsonResponse({ ok: true }, 200);
    } catch (error) {
      console.error(error);
      return jsonResponse({ error: "Error interno del servidor" }, 500);
    }
  };
}

export function createPostHandler(service: DocumentService): APIRoute {
  return async ({ request }) => {
    try {
      const payload = (await request.json()) as CreateDocumentPayload;

      const result = await service.create({
        id: payload.id,
        title: payload.title,
        description: payload.description,
        author: payload.author,
        date: payload.date ? new Date(payload.date) : undefined,
        index: payload.index,
        position: payload.position,
        draft: payload.draft,
        tags: payload.tags,
      });

      if (!result.ok) {
        return handleServiceError(result.error);
      }

      return jsonResponse(result.value, 201);
    } catch (error) {
      console.error(error);
      return jsonResponse({ error: "Error interno del servidor" }, 500);
    }
  };
}

function handleServiceError(error: DocumentServiceError): Response {
  if (error instanceof InvalidDocumentIdError) {
    return jsonResponse({ error: error.message }, 400);
  }

  if (error instanceof DocumentNotFoundError) {
    return jsonResponse({ error: error.message }, 404);
  }

  if (error instanceof DocumentAlreadyExistsError) {
    return jsonResponse({ error: error.message }, 409);
  }

  if (error instanceof ParentNotFoundError) {
    return jsonResponse({ error: error.message }, 400);
  }

  console.error(error);
  return jsonResponse({ error: "Error interno del servidor" }, 500);
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
