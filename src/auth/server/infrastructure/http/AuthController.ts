import type { APIRoute } from "astro";

interface BetterAuthHandler {
  handler(request: Request): Response | Promise<Response>;
}

export function createAuthController(auth: BetterAuthHandler): APIRoute {
  return ({ request }) => auth.handler(request);
}
