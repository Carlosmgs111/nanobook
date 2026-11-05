import { createHash } from "node:crypto";
import type { APIRoute } from "astro";

import type { UnlockDocument } from "../../application/access/UnlockDocument";
import {
  DocumentNotFoundError,
  DocumentUnlockFailedError,
  DocumentUnlockRateLimitedError,
} from "../../domain/errors";
import { serializeGrantCookie } from "./GrantCookie";
import { jsonResponse } from "./utils";

function clientKey(request: Request, clientAddress: string | undefined): string {
  const ip = request.headers.get("x-vercel-forwarded-for") ?? clientAddress ?? "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export class UnlockDocumentController {
  constructor(private readonly unlockDocument: UnlockDocument) {}

  handle: APIRoute = async ({ params, request, clientAddress }) => {
    const { nanobookId } = params;
    if (!nanobookId) return jsonResponse({ error: "Falta el parámetro nanobookId" }, 400);

    let body: { path?: unknown; password?: unknown };
    try {
      body = JSON.parse(await request.text());
    } catch {
      return jsonResponse({ error: "Solicitud inválida" }, 400);
    }
    if (typeof body?.path !== "string" || !body.path || typeof body.password !== "string" || !body.password) {
      return jsonResponse({ error: "path y password son obligatorios" }, 400);
    }

    let address: string | undefined;
    try {
      address = clientAddress;
    } catch {
      address = undefined;
    }

    const result = await this.unlockDocument.execute({
      nanobookId,
      documentPath: body.path,
      password: body.password,
      clientKey: clientKey(request, address),
    });

    if (result.isSuccess) {
      const grant = result.getValue();
      const response = jsonResponse({ ok: true }, 200);
      response.headers.set("Set-Cookie", serializeGrantCookie(grant.documentId, grant.token, grant.maxAgeSeconds));
      response.headers.set("Cache-Control", "no-store");
      return response;
    }

    const error = result.getError();
    if (error instanceof DocumentUnlockRateLimitedError) {
      const response = jsonResponse({ error: error.message }, 429);
      response.headers.set("Retry-After", String(error.retryAfterSeconds));
      return response;
    }
    if (error instanceof DocumentUnlockFailedError) return jsonResponse({ error: error.message }, 403);
    if (error instanceof DocumentNotFoundError) return jsonResponse({ error: "Documento no encontrado" }, 404);
    console.error(error);
    return jsonResponse({ error: "Error interno del servidor" }, 500);
  };
}
