import type { APIRoute } from "astro";
import { getApp } from "../../../../../application/server/Application";
import { withNanobookWriteAccess } from "../../../../../nanobooks/server/infraestructure/rest/withNanobookWriteAccess";

export const prerender = false;

const app = await getApp();

async function dispatch(
  method: "POST" | "PATCH" | "DELETE",
  requestContext: Parameters<APIRoute>[0],
) {
  return withNanobookWriteAccess(
    app.nanobookModule.getNanobookById,
    app.nanobookModule.documentModule.mutationRoutes[method],
  )(requestContext);
}

export const POST: APIRoute = (context) => dispatch("POST", context);
export const PATCH: APIRoute = (context) => dispatch("PATCH", context);
export const DELETE: APIRoute = (context) => dispatch("DELETE", context);
