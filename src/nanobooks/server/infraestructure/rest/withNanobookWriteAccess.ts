import type { APIRoute } from "astro";

import {
  Subject,
  accessErrorResponse,
  type Authorizer,
} from "../../../../authorization/server";
import type { RouteProtector } from "../../../../shared/server/capabilities/RouteProtector";

export function withNanobookWriteAccess(authorizer: Authorizer, handler: APIRoute): APIRoute {
  return async (context) => {
    const userId = context.locals.currentUserId;
    if (!userId) return Response.json({ error: "Autenticación requerida" }, { status: 401 });

    const nanobookId = context.params.nanobookId;
    if (!nanobookId) return Response.json({ error: "Nanobook no encontrado" }, { status: 404 });

    const result = await authorizer.require({
      subject: Subject.of(userId),
      action: "write",
      resource: { type: "nanobook", id: nanobookId },
    });
    if (!result.isSuccess) return accessErrorResponse(result.getError());

    return handler(context);
  };
}

export function protectNanobookWriteMutation(
  routeProtector: RouteProtector,
  authorizer: Authorizer,
  handler: APIRoute,
): APIRoute {
  return routeProtector.protect(withNanobookWriteAccess(authorizer, handler));
}
