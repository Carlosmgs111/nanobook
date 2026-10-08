import type { APIRoute } from "astro";
import type { CreateCurrentProfile } from "../../application/CreateCurrentProfile";
import { handleProfileError, jsonResponse } from "./utils";

export class CreateCurrentProfileController {
  constructor(private readonly createProfile: CreateCurrentProfile) {}

  handle: APIRoute = async ({ request, locals }) => {
    if (!locals.currentUserId) return jsonResponse({ error: "Autenticación requerida" }, 401);
    try {
      const body: unknown = await request.json();
      if (!isCreatePayload(body)) return jsonResponse({ error: "username y displayName son obligatorios" }, 400);
      const result = await this.createProfile.execute(locals.currentUserId, body);
      return result.isSuccess ? jsonResponse(result.getValue().toPublic(), 201) : handleProfileError(result.getError());
    } catch (error) {
      return jsonResponse({ error: "Cuerpo de solicitud inválido" }, 400);
    }
  };
}

function isCreatePayload(value: unknown): value is { username: string; displayName: string } {
  return typeof value === "object" && value !== null && typeof (value as any).username === "string" && typeof (value as any).displayName === "string";
}
