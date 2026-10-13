import type { APIRoute } from "astro";
import { ListNanobooks } from "../../application/ListNanobooks";

export class ListNanobooksController {
  constructor(private readonly listNanobooks: ListNanobooks) {}

  handle: APIRoute = async ({ locals }) => {
    if (!locals.currentUserId) {
      return new Response(JSON.stringify({ error: "Autenticación requerida" }), { status: 401 });
    }
    const result = await this.listNanobooks.execute(locals.currentUserId);
    if (!result.isSuccess) {
      return new Response(JSON.stringify({ error: result.getError().message }), { status: 500 });
    }
    return new Response(JSON.stringify(result.getValue().map((nanobook) => ({
      id: nanobook.getId(),
      slug: nanobook.getSlug(),
      name: nanobook.getName(),
      visibility: nanobook.getVisibility(),
      contentVersion: nanobook.getContentVersion(),
    }))), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
}
