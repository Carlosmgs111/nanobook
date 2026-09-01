import type { APIRoute } from "astro";
import { contentRepository } from "../../document/_index";
import {
  invalidateCache,
  type InvalidateRequest,
} from "../../document/change/invalidate-handler";
import { createRenderedPageCache } from "../../publishing/infraestructure/cache";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");

  if (token !== process.env.INVALIDATE_TOKEN) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: Partial<InvalidateRequest>;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.changes || !Array.isArray(body.changes)) {
    return new Response(
      JSON.stringify({ error: "Missing or invalid changes array" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const cache = await createRenderedPageCache();
  console.log("cache:", cache);

  const result = await invalidateCache(contentRepository, cache, {
    changes: body.changes,
  });

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
