import type { APIRoute } from "astro";
import type { RouteProtector } from "../../../../shared/server/capabilities/RouteProtector";

export interface DocumentMutationRoutes {
  POST: APIRoute;
  PATCH: APIRoute;
  DELETE: APIRoute;
}

export function protectDocumentMutationRoutes(
  protector: RouteProtector,
  routes: DocumentMutationRoutes,
): DocumentMutationRoutes {
  return {
    POST: protector.protect(routes.POST),
    PATCH: protector.protect(routes.PATCH),
    DELETE: protector.protect(routes.DELETE),
  };
}
