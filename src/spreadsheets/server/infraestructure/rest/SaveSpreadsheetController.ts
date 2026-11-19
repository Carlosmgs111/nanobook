import type { APIRoute } from "astro";
import { z } from "zod";
import { AccessCheckFailedError, AccessDeniedError, accessErrorResponse } from "../../../../authorization/server";
import { sheetRows } from "../../../shared/sheet";
import type { SaveSpreadsheet, SaveSpreadsheetError } from "../../application/SaveSpreadsheet";
import {
  InvalidSheetError,
  SheetDocumentNotFoundError,
  SheetNotFoundError,
  SheetRevisionConflictError,
} from "../../domain/errors";

const body = z.object({ documentPath: z.string().min(1), original: sheetRows, next: sheetRows }).strict();

const json = (payload: unknown, status: number) => Response.json(payload, { status });

function toResponse(error: SaveSpreadsheetError): Response {
  if (error instanceof AccessDeniedError || error instanceof AccessCheckFailedError) return accessErrorResponse(error);
  if (error instanceof SheetDocumentNotFoundError) return json({ error: error.message }, 404);
  if (error instanceof SheetNotFoundError || error instanceof SheetRevisionConflictError) return json({ error: error.message }, 409);
  if (error instanceof InvalidSheetError) return json({ error: error.message }, 422);
  console.error(error);
  return json({ error: "Error interno del servidor" }, 500);
}

export class SaveSpreadsheetController {
  constructor(private readonly saveSpreadsheet: SaveSpreadsheet) {}

  handle: APIRoute = async ({ params, request, locals }) => {
    try {
      const { nanobookId } = params;
      if (!nanobookId) return json({ error: "Falta el parámetro nanobookId" }, 400);
      if (!locals.currentUserId) return json({ error: "Autenticación requerida" }, 401);

      const payload = body.safeParse(await request.json().catch(() => undefined));
      if (!payload.success) return json({ error: "Cuerpo inválido" }, 400);

      const result = await this.saveSpreadsheet.execute({ nanobookId, actorId: locals.currentUserId, ...payload.data });
      return result.isSuccess ? json({ ok: true }, 200) : toResponse(result.getError());
    } catch (error) {
      console.error(error);
      return json({ error: "Error interno del servidor" }, 500);
    }
  };
}
