import type { APIRoute } from "astro";
import { getApp } from "../../../../../application/server/Application";

export const prerender = false;

const app = await getApp();

function withDocumentId(handler: APIRoute): APIRoute {
  return async (requestContext) => handler({
    ...requestContext,
    params: { ...requestContext.params, slug: requestContext.params.id },
  });
}

async function dispatch(
  method: "POST" | "PATCH" | "DELETE",
  requestContext: Parameters<APIRoute>[0],
) {
  const nanobookId = requestContext.params.nanobookId;
  if (!nanobookId) return new Response(JSON.stringify({ error: "Nanobook no encontrado" }), { status: 404 });
  let context;
  try {
    context = await app.nanobookModule.forNanobook(nanobookId);
  } catch {
    return new Response(JSON.stringify({ error: "Nanobook no encontrado" }), { status: 404 });
  }
  return withDocumentId(context.documentModule.mutationRoutes[method])(requestContext);
}

export const POST: APIRoute = (context) => dispatch("POST", context);
export const PATCH: APIRoute = (context) => dispatch("PATCH", context);
export const DELETE: APIRoute = (context) => dispatch("DELETE", context);
