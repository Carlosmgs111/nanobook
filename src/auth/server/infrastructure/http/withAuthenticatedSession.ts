import type { APIRoute } from "astro";

import { BetterAuthSessionReader } from "../better-auth/BetterAuthSessionReader";

export function withAuthenticatedSession(
  sessionReader: BetterAuthSessionReader,
  handler: APIRoute
): APIRoute {
  return async (context) => {
    const user = await sessionReader.getSession(context.request.headers);
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Autenticación requerida" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        }
      );
    }

    if (!["GET", "HEAD", "OPTIONS"].includes(context.request.method)) {
      const origin = context.request.headers.get("Origin");
      const expectedOrigin = new URL(context.request.url).origin;
      if (origin !== expectedOrigin) {
        return new Response(JSON.stringify({ error: "Origen no permitido" }), {
          status: 403,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      }
    }

    context.locals.currentUser = user;
    context.locals.currentUserId = user.id;
    const response = await handler(context);
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "private, no-store");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}
