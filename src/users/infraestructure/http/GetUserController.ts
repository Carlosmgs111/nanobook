import type { GetUser } from "../../application/GetUser";
import { handleUserError, jsonResponse } from "./utils";
import type { UserRoute } from "./utils";

export class GetUserController {
  constructor(private readonly getUser: GetUser) {}

  handle: UserRoute = async ({ params }) => {
    try {
      const id = params.id;
      if (!id) return jsonResponse({ error: "Falta el parámetro id" }, 400);
      const result = await this.getUser.execute(id);
      if (!result.isSuccess) return handleUserError(result.getError());
      return jsonResponse(result.getValue(), 200);
    } catch (error) {
      return handleUserError(error instanceof Error ? error : new Error(String(error)));
    }
  };
}
