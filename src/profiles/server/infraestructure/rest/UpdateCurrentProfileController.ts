import type { APIRoute } from "astro";
import type { UpdateCurrentProfile } from "../../application/UpdateCurrentProfile";
import { handleProfileError, jsonResponse } from "./utils";

export class UpdateCurrentProfileController {
  constructor(private readonly updateProfile: UpdateCurrentProfile) {}
  handle: APIRoute = async ({ request, locals }) => {
    if (!locals.currentUserId) return jsonResponse({ error: "Autenticación requerida" }, 401);
    try {
      const body: unknown = await request.json();
      if (!isUpdatePayload(body)) return jsonResponse({ error: "displayName es obligatorio" }, 400);
      const result = await this.updateProfile.execute(locals.currentUserId, { displayName: body.displayName });
      return result.isSuccess ? jsonResponse(result.getValue(), 200) : handleProfileError(result.getError());
    } catch {
      return jsonResponse({ error: "Cuerpo de solicitud inválido" }, 400);
    }
  };
}

function isUpdatePayload(value: unknown): value is { displayName: string } {
  return typeof value === "object" && value !== null && typeof (value as any).displayName === "string";
}
