import type { APIRoute } from "astro";

import type { ClearDocumentPassword } from "../../application/access/ClearDocumentPassword";
import type { DocumentAccessAdminError, SetDocumentPassword } from "../../application/access/SetDocumentPassword";
import {
  DocumentAccessDeniedError,
  DocumentNotFoundError,
  DocumentRevisionConflictError,
  InvalidDocumentPasswordError,
} from "../../domain/errors";
import { jsonResponse } from "./utils";

function toResponse(error: DocumentAccessAdminError): Response {
  if (error instanceof InvalidDocumentPasswordError) return jsonResponse({ error: error.message }, 400);
  if (error instanceof DocumentNotFoundError) return jsonResponse({ error: error.message }, 404);
  if (error instanceof DocumentAccessDeniedError) return jsonResponse({ error: error.message }, 403);
  if (error instanceof DocumentRevisionConflictError) return jsonResponse({ error: error.message }, 409);
  console.error(error);
  return jsonResponse({ error: "Error interno del servidor" }, 500);
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const payload = JSON.parse(await request.text());
    return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export class DocumentAccessAdminController {
  constructor(
    private readonly setPassword: SetDocumentPassword,
    private readonly clearPassword: ClearDocumentPassword,
  ) {}

  put: APIRoute = async ({ params, request, locals }) => {
    if (!locals.currentUserId) return jsonResponse({ error: "Autenticación requerida" }, 401);
    const { nanobookId } = params;
    if (!nanobookId) return jsonResponse({ error: "Falta el parámetro nanobookId" }, 400);

    const body = await readBody(request);
    if (!body || typeof body.path !== "string" || !body.path || typeof body.password !== "string") {
      return jsonResponse({ error: "path y password son obligatorios" }, 400);
    }

    const result = await this.setPassword.execute(nanobookId, body.path, body.password, locals.currentUserId);
    return result.isSuccess ? jsonResponse({ secured: true }, 200) : toResponse(result.getError());
  };

  delete: APIRoute = async ({ params, request, locals }) => {
    if (!locals.currentUserId) return jsonResponse({ error: "Autenticación requerida" }, 401);
    const { nanobookId } = params;
    if (!nanobookId) return jsonResponse({ error: "Falta el parámetro nanobookId" }, 400);

    const body = await readBody(request);
    if (!body || typeof body.path !== "string" || !body.path) {
      return jsonResponse({ error: "path es obligatorio" }, 400);
    }

    const result = await this.clearPassword.execute(nanobookId, body.path, locals.currentUserId);
    return result.isSuccess ? jsonResponse({ secured: false }, 200) : toResponse(result.getError());
  };
}
