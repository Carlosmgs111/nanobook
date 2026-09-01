import type { APIRoute } from "astro";
import type { InvalidatePublishedPages } from "../../application/InvalidatePublishedPages";
import { INVALIDATE_TOKEN } from "astro:env/server";

export class InvalidatePagesController {
  constructor(
    private invalidatePublishedPage: InvalidatePublishedPages,
  ) {}

  handle: APIRoute = async ({ request }) => {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");

    if (token !== INVALIDATE_TOKEN) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    let body;
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
    const result = await this.invalidatePublishedPage.execute(body.changes);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
}
