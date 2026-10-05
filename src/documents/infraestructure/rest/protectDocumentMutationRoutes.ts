import type { APIRoute } from "astro";

export interface RouteProtector {
  protect(handler: APIRoute): APIRoute;
}

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
