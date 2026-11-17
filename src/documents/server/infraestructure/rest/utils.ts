import type { APIRoute } from "astro";
import {
  type DocumentServiceError,
  InvalidDocumentIdError,
  InvalidDocumentError,
  DocumentNotFoundError,
  DocumentAlreadyExistsError,
  DocumentRevisionConflictError,
  ParentNotFoundError,
} from "../../domain/errors";
import {
  AccessCheckFailedError,
  AccessDeniedError,
  accessErrorResponse,
} from "../../../../authorization/server";
import type { InfrastructureError } from "../../../../shared/errors";

export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function handleServiceError(
  error: DocumentServiceError | InfrastructureError | AccessDeniedError | AccessCheckFailedError
): Response {
  if (error instanceof AccessDeniedError || error instanceof AccessCheckFailedError) {
    return accessErrorResponse(error);
  }

  if (
    error instanceof InvalidDocumentIdError ||
    error instanceof InvalidDocumentError ||
    error instanceof ParentNotFoundError
  ) {
    return jsonResponse({ error: error.message }, 400);
  }

  if (error instanceof DocumentNotFoundError) {
    return jsonResponse({ error: error.message }, 404);
  }

  if (error instanceof DocumentAlreadyExistsError) {
    return jsonResponse({ error: error.message }, 409);
  }

  if (error instanceof DocumentRevisionConflictError) {
    return jsonResponse({
      error: error.message,
      expectedRevision: error.expectedRevision,
      actualRevision: error.actualRevision,
    }, 409);
  }

  console.error(error);
  return jsonResponse({ error: "Error interno del servidor" }, 500);
}

export interface DocumentMutation {
  nanobookId: string;
  documentId: string;
  actorId: string;
  request: Request;
}

/** Valida ruta y sesión, y traduce cualquier excepción a un 500; el permiso de escritura lo exige el caso de uso. */
export function documentMutationRoute(
  handle: (mutation: DocumentMutation) => Promise<Response>,
): APIRoute {
  return async ({ params, request, locals }) => {
    try {
      const { id: documentId, nanobookId } = params;
      if (!documentId) return jsonResponse({ error: "Falta el parámetro id" }, 400);
      if (!nanobookId) return jsonResponse({ error: "Falta el parámetro nanobookId" }, 400);
      if (!locals.currentUserId) return jsonResponse({ error: "Autenticación requerida" }, 401);
      return await handle({ nanobookId, documentId, actorId: locals.currentUserId, request });
    } catch (error) {
      console.error(error);
      return jsonResponse({ error: "Error interno del servidor" }, 500);
    }
  };
}
