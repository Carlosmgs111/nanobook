import type { APIRoute } from "astro";

import { AuthorizeNanobook } from "../../application/AuthorizeNanobook";
import type { GetNanobookById } from "../../application/GetNanobookById";

export function withNanobookWriteAccess(
  nanobookReader: Pick<GetNanobookById, "execute">,
  handler: APIRoute,
): APIRoute {
  return async (context) => {
    const userId = context.locals.currentUserId;
    if (!userId) return jsonError("Autenticación requerida", 401);

    const nanobookId = context.params.nanobookId;
    if (!nanobookId) return jsonError("Nanobook no encontrado", 404);

    const result = await nanobookReader.execute(nanobookId);
    if (!result.isSuccess || !result.getValue()) {
      return jsonError("Nanobook no encontrado", 404);
    }

    const nanobook = result.getValue();
    if (!new AuthorizeNanobook().canWrite(nanobook, userId)) {
      return jsonError("No tienes permiso de edición sobre el nanobook", 403);
    }

    return handler(context);
  };
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}
