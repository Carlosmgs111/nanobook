import type { APIRoute } from "astro";
import type  { Reading } from "../../application/Reading";

export class ListNanobooksController {
  constructor(private readonly listNanobooks: Reading["listNanobooks"]) {}

  handle: APIRoute = async ({ locals }) => {
    if (!locals.currentUserId) {
      return new Response(JSON.stringify({ error: "Autenticación requerida" }), { status: 401 });
    }
    const result = await this.listNanobooks(locals.currentUserId);
    if (!result.isSuccess) {
      return new Response(JSON.stringify({ error: result.getError().message }), { status: 500 });
    }
    return new Response(JSON.stringify(result.getValue().map((nanobook) => ({
      id: nanobook.getId(),
      slug: nanobook.getSlug(),
      name: nanobook.getName(),
      visibility: nanobook.getVisibility(),
    }))), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
}
