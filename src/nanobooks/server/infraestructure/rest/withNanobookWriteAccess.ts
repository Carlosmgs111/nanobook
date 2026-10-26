import type { APIRoute } from "astro";

import { NanobookAccessDeniedError } from "../../application/AuthorizeNanobook";
import { NanobookNotFoundError } from "../../application/errors";
import type { NanobookAccessRequirement } from "../../application/RequireNanobookAccess";
import type { RouteProtector } from "../../../../shared/server/capabilities/RouteProtector";

export function withNanobookWriteAccess(
  nanobookAccess: NanobookAccessRequirement,
  handler: APIRoute,
): APIRoute {
  return async (context) => {
    const userId = context.locals.currentUserId;
    if (!userId) return jsonError("Autenticación requerida", 401);

    const nanobookId = context.params.nanobookId;
    if (!nanobookId) return jsonError("Nanobook no encontrado", 404);

    const result = await nanobookAccess.execute(userId, nanobookId, "write");
    if (!result.isSuccess) {
      const error = result.getError();
      if (error instanceof NanobookNotFoundError) return jsonError("Nanobook no encontrado", 404);
      if (error instanceof NanobookAccessDeniedError) return jsonError("No tienes permiso de edición sobre el nanobook", 403);
      return jsonError("No fue posible comprobar el permiso sobre el nanobook", 500);
    }

    return handler(context);
  };
}

export function protectNanobookWriteMutation(
  routeProtector: RouteProtector,
  nanobookAccess: NanobookAccessRequirement,
  handler: APIRoute,
): APIRoute {
  return routeProtector.protect(withNanobookWriteAccess(nanobookAccess, handler));
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}
