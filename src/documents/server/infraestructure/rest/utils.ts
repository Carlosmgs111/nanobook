import {
  type DocumentServiceError,
  InvalidDocumentIdError,
  InvalidDocumentError,
  DocumentNotFoundError,
  DocumentAlreadyExistsError,
  DocumentAccessDeniedError,
  DocumentRevisionConflictError,
  ParentNotFoundError,
} from "../../domain/errors";
import type { InfrastructureError } from "../../../../shared/errors";

export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function handleServiceError(
  error: DocumentServiceError | InfrastructureError
): Response {
  if (error instanceof InvalidDocumentIdError) {
    return jsonResponse({ error: error.message }, 400);
  }

  if (error instanceof InvalidDocumentError) {
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

  if (error instanceof DocumentAccessDeniedError) {
    return jsonResponse({ error: error.message }, 403);
  }

  if (error instanceof ParentNotFoundError) {
    return jsonResponse({ error: error.message }, 400);
  }

  console.error(error);
  return jsonResponse({ error: "Error interno del servidor" }, 500);
}
