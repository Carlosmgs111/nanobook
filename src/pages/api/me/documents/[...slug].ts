import type { APIRoute } from "astro";
import { getApp } from "../../../../application/server/Application";
import { shouldUseNanobookSqlCutover } from "../../../../application/server/legacyRouteMode";

const app = await getApp();

export const prerender = false;

function guardLegacyMutation(handler: APIRoute): APIRoute {
  return async (context) => {
    if (shouldUseNanobookSqlCutover()) {
      return new Response(JSON.stringify({ error: "Usa el endpoint del nanobook canónico" }), {
        status: 410,
        headers: { "Content-Type": "application/json" },
      });
    }
    return handler(context);
  };
}

export const POST = guardLegacyMutation(app.documentModule.mutationRoutes.POST);
export const PATCH = guardLegacyMutation(app.documentModule.mutationRoutes.PATCH);
export const DELETE = guardLegacyMutation(app.documentModule.mutationRoutes.DELETE);
