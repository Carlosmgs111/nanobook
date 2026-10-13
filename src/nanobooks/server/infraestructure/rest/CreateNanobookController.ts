import type { APIRoute } from "astro";
import { CreateNanobook } from "../../application/CreateNanobook";

export class CreateNanobookController {
  constructor(private readonly createNanobook: CreateNanobook) {}

  handle: APIRoute = async ({ request, locals }) => {
    if (!locals.currentUserId) {
      return new Response(JSON.stringify({ error: "Autenticación requerida" }), { status: 401 });
    }
    try {
      const body = await request.json();
      const result = await this.createNanobook.execute(locals.currentUserId, {
        slug: body.slug,
        name: body.name,
        visibility: body.visibility,
      });
      if (!result.isSuccess) {
        const status = result.getError().name.includes("Slug") ? 409 : 400;
        return new Response(JSON.stringify({ error: result.getError().message }), { status });
      }
      const nanobook = result.getValue();
      return new Response(JSON.stringify({
        id: nanobook.getId(),
        slug: nanobook.getSlug(),
        name: nanobook.getName(),
        visibility: nanobook.getVisibility(),
      }), { status: 201, headers: { "Content-Type": "application/json" } });
    } catch (error) {
      return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Solicitud inválida" }), { status: 400 });
    }
  };
}
