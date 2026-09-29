import type { DeleteUser } from "../../../application/DeleteUser";
import { handleUserError, jsonResponse } from "./utils";
import type { UserRoute } from "./utils";

export class DeleteUserController {
  constructor(private readonly deleteUser: DeleteUser) {}

  handle: UserRoute = async ({ params }) => {
    try {
      const id = params.id;
      if (!id) return jsonResponse({ error: "Falta el parámetro id" }, 400);
      const result = await this.deleteUser.execute(id);
      if (!result.isSuccess) return handleUserError(result.getError());
      return jsonResponse({ ok: true }, 200);
    } catch (error) {
      return handleUserError(error instanceof Error ? error : new Error(String(error)));
    }
  };
}
