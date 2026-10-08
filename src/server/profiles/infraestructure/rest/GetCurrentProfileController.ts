import type { APIRoute } from "astro";
import type { GetCurrentProfile } from "../../application/GetCurrentProfile";
import { handleProfileError, jsonResponse } from "./utils";

export class GetCurrentProfileController {
  constructor(private readonly getProfile: GetCurrentProfile) {}
  handle: APIRoute = async ({ locals }) => {
    if (!locals.currentUserId) return jsonResponse({ error: "Autenticación requerida" }, 401);
    const result = await this.getProfile.execute(locals.currentUserId);
    return result.isSuccess ? jsonResponse(result.getValue(), 200) : handleProfileError(result.getError());
  };
}
