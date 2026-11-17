import { AccessCheckFailedError, type AccessDeniedError } from "../domain/errors";
import type { DenyReason } from "../domain/types";

const DENIED: Record<DenyReason, { status: number; error: string }> = {
  unauthenticated: { status: 401, error: "Autenticación requerida" },
  forbidden: { status: 403, error: "No tienes permiso sobre este recurso" },
  "not-found": { status: 404, error: "Recurso no encontrado" },
};

/** Respuesta HTTP única para cualquier error de acceso. Nunca expone la causa de un fallo técnico. */
export function accessErrorResponse(error: AccessDeniedError | AccessCheckFailedError): Response {
  if (error instanceof AccessCheckFailedError) {
    return Response.json({ error: "No fue posible comprobar el acceso" }, { status: 500 });
  }

  const decision = error.decision;
  if (decision.effect === "challenge") {
    return Response.json(
      { error: "Este recurso requiere contraseña", challenge: decision.kind },
      { status: 401 },
    );
  }

  const { status, error: message } = DENIED[decision.reason] ?? DENIED.forbidden;
  return Response.json({ error: message }, { status });
}
