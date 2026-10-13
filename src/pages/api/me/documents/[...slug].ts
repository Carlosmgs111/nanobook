import type { APIRoute } from "astro";

export const prerender = false;

function legacyMutationGone(): Response {
  return new Response(JSON.stringify({ error: "Usa el endpoint del nanobook canónico" }), {
    status: 410,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = () => legacyMutationGone();
export const PATCH: APIRoute = () => legacyMutationGone();
export const DELETE: APIRoute = () => legacyMutationGone();
