import type { DeniedDecision } from "./types";

/** El acceso no se concedió. Conserva la decisión para que el borde elija la respuesta. */
export class AccessDeniedError extends Error {
  constructor(public readonly decision: DeniedDecision) {
    super(
      decision.effect === "challenge"
        ? "Se requiere desbloquear el recurso"
        : `Acceso denegado: ${decision.reason}`,
    );
    this.name = "AccessDeniedError";
  }
}

/** No fue posible evaluar el acceso por un fallo técnico. Nunca equivale a conceder. */
export class AccessCheckFailedError extends Error {
  constructor(cause: unknown) {
    super("No fue posible comprobar el acceso", { cause });
    this.name = "AccessCheckFailedError";
  }
}
