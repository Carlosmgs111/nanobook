import type { APIRoute } from "astro";

import { NanobookAccessDeniedError } from "../../application/AuthorizeNanobook";
import { NanobookNotFoundError } from "../../application/errors";
import type { RequireNanobookAccess } from "../../application/RequireNanobookAccess";

export function withNanobookWriteAccess(
  nanobookAccess: Pick<RequireNanobookAccess, "execute">,
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

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}
