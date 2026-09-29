import type { CreateUser } from "../../../application/CreateUser";
import { jsonResponse, handleUserError, parseJsonObject, routeError } from "./utils";
import type { UserRoute } from "./utils";

export class CreateUserController {
  constructor(private readonly createUser: CreateUser) {}

  handle: UserRoute = async ({ request }) => {
    try {
      const payload = await parseJsonObject(request);
      if (typeof payload.email !== "string" || typeof payload.displayName !== "string") {
        return jsonResponse(
          { error: "email y displayName son obligatorios y deben ser texto" },
          400
        );
      }

      const result = await this.createUser.execute({
        email: payload.email,
        displayName: payload.displayName,
      });
      if (!result.isSuccess) return handleUserError(result.getError());
      return jsonResponse(result.getValue(), 201);
    } catch (error) {
      return routeError(error);
    }
  };
}
