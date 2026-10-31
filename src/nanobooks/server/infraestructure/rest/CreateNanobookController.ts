import type { APIRoute } from "astro";
import type { CreateNanobook } from "../../application/CreateNanobook";

export class CreateNanobookController {
  constructor(
    private readonly createNanobook: CreateNanobook
  ) {}

  handle: APIRoute = async ({ request, locals }) => {
    if (!locals.currentUserId) {
      return new Response(
        JSON.stringify({ error: "Autenticación requerida" }),
        { status: 401 }
      );
    }
    try {
      const body = await request.json();
      const result = await this.createNanobook.execute(locals.currentUserId, {
        slug: body.slug,
        name: body.name,
        visibility: body.visibility,
      });
      if (!result.isSuccess) {
        const error = result.getError();
        const status = statusForCreateError(error);
        return new Response(
          JSON.stringify({
            error: status === 500 ? "No fue posible crear el nanobook" : error.message,
          }),
          { status }
        );
      }
      const nanobook = result.getValue();
      return new Response(
        JSON.stringify({
          id: nanobook.getId(),
          slug: nanobook.getSlug(),
          name: nanobook.getName(),
          visibility: nanobook.getVisibility(),
        }),
        { status: 201, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Solicitud inválida",
        }),
        { status: 400 }
      );
    }
  };
}

function statusForCreateError(error: Error): number {
  if (error.name === "NanobookSlugAlreadyTakenError") return 409;
  if (
    error.name === "InvalidNanobookError" ||
    error.name === "InvalidNanobookSlugError"
  ) {
    return 400;
  }
  return 500;
}
