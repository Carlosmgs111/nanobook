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
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    context.locals.currentUser = user;
    context.locals.currentUserId = user.id;
    return handler(context);
  };
}
