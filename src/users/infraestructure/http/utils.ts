import type { APIRoute } from "astro";
import {
  InvalidUserError,
  InvalidUserIdError,
  UserEmailAlreadyExistsError,
  UserRepositoryError,
} from "../../domain/errors";
import { UserNotFoundError } from "../../application/errors";

export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function handleUserError(error: Error): Response {
  if (error instanceof InvalidUserError || error instanceof InvalidUserIdError) {
    return jsonResponse({ error: error.message }, 400);
  }
  if (error instanceof UserNotFoundError) {
    return jsonResponse({ error: error.message }, 404);
  }
  if (error instanceof UserEmailAlreadyExistsError) {
    return jsonResponse({ error: error.message }, 409);
  }
  if (error instanceof UserRepositoryError) {
    console.error(error);
    return jsonResponse({ error: "Error interno del servidor" }, 500);
  }
  console.error(error);
  return jsonResponse({ error: "Error interno del servidor" }, 500);
}

export async function parseJsonObject(request: Request): Promise<Record<string, unknown>> {
  const payload: unknown = await request.json();
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new InvalidUserError("el cuerpo debe ser un objeto JSON");
  }
  return payload as Record<string, unknown>;
}

export function routeError(error: unknown): Response {
  if (error instanceof SyntaxError || error instanceof InvalidUserError) {
    return handleUserError(
      error instanceof InvalidUserError
        ? error
        : new InvalidUserError("JSON inválido")
    );
  }
  return handleUserError(error instanceof Error ? error : new Error(String(error)));
}

export type UserRoute = APIRoute;
