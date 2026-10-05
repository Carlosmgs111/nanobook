import type { APIRoute } from "astro";

import type { GetAuthenticatedSession } from "../../application/GetAuthenticatedSession";

export function withAuthenticatedSession(
  getAuthenticatedSession: GetAuthenticatedSession,
  handler: APIRoute,
): APIRoute {
  return async (context) => {
    const user = await getAuthenticatedSession.execute(context.request.headers);
    if (!user) {
      return new Response(JSON.stringify({ error: "Autenticación requerida" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    context.locals.currentUser = user;
    context.locals.currentUserId = user.id;
    return handler(context);
  };
}
