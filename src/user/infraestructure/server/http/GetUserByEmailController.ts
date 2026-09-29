import type { GetUserByEmail } from "../../../application/GetUserByEmail";
import { handleUserError, jsonResponse } from "./utils";
import type { UserRoute } from "./utils";

export class GetUserByEmailController {
  constructor(private readonly getUserByEmail: GetUserByEmail) {}

  handle: UserRoute = async ({ request }) => {
    try {
      const email = new URL(request.url).searchParams.get("email");
      if (!email) return jsonResponse({ error: "Falta el parámetro email" }, 400);
      const result = await this.getUserByEmail.execute(email);
      if (!result.isSuccess) return handleUserError(result.getError());
      return jsonResponse(result.getValue(), 200);
    } catch (error) {
      return handleUserError(error instanceof Error ? error : new Error(String(error)));
    }
  };
}
