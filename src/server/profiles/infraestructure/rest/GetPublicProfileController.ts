import type { APIRoute } from "astro";
import type { GetPublicProfileByUsername } from "../../application/GetPublicProfileByUsername";
import { handleProfileError, jsonResponse } from "./utils";

export class GetPublicProfileController {
  constructor(private readonly getProfile: GetPublicProfileByUsername) {}
  handle: APIRoute = async ({ params }) => {
    if (!params.username) return jsonResponse({ error: "Falta username" }, 400);
    const result = await this.getProfile.execute(params.username);
    return result.isSuccess ? jsonResponse(result.getValue(), 200) : handleProfileError(result.getError());
  };
}
