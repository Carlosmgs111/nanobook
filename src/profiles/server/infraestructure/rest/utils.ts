import { InvalidProfileError, InvalidUsernameError } from "../../domain/errors";
import { ProfileAlreadyExistsError, ProfileNotFoundError, UsernameAlreadyTakenError } from "../../application/errors";

export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export function handleProfileError(error: Error): Response {
  if (error instanceof InvalidProfileError || error instanceof InvalidUsernameError) return jsonResponse({ error: error.message }, 400);
  if (error instanceof ProfileNotFoundError) return jsonResponse({ error: error.message }, 404);
  if (error instanceof ProfileAlreadyExistsError || error instanceof UsernameAlreadyTakenError) return jsonResponse({ error: error.message }, 409);
  console.error(error);
  return jsonResponse({ error: "Error interno del servidor" }, 500);
}
