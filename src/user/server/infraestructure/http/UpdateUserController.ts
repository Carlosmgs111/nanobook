import type { UpdateUser } from "../../application/UpdateUser";
import { handleUserError, jsonResponse, parseJsonObject, routeError } from "./utils";
import type { UserRoute } from "./utils";

export class UpdateUserController {
  constructor(private readonly updateUser: UpdateUser) {}

  handle: UserRoute = async ({ params, request }) => {
    try {
      const id = params.id;
      if (!id) return jsonResponse({ error: "Falta el parámetro id" }, 400);
      const payload = await parseJsonObject(request);
      const hasEmail = Object.prototype.hasOwnProperty.call(payload, "email");
      const hasDisplayName = Object.prototype.hasOwnProperty.call(payload, "displayName");
      if (!hasEmail && !hasDisplayName) {
        return jsonResponse({ error: "Debe indicar email o displayName" }, 400);
      }
      if (
        (hasEmail && typeof payload.email !== "string") ||
        (hasDisplayName && typeof payload.displayName !== "string")
      ) {
        return jsonResponse({ error: "Los campos de perfil deben ser texto" }, 400);
      }

      const result = await this.updateUser.execute(id, {
        email: hasEmail ? payload.email as string : undefined,
        displayName: hasDisplayName ? payload.displayName as string : undefined,
      });
      if (!result.isSuccess) return handleUserError(result.getError());
      return jsonResponse(result.getValue(), 200);
    } catch (error) {
      return routeError(error);
    }
  };
}
