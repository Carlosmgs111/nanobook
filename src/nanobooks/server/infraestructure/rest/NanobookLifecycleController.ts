import type { APIRoute } from "astro";
import type { UpdateNanobook } from "../../application/UpdateNanobook";
import type { DeleteNanobook } from "../../application/DeleteNanobook";


export class NanobookLifecycleController {
  constructor(
    private readonly updateNanobook: UpdateNanobook,
    private readonly deleteNanobook: DeleteNanobook
  ) {}

  update: APIRoute = async ({ request, locals, params }) => {
    if (!locals.currentUserId) return jsonError("Autenticación requerida", 401);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("JSON inválido", 400);
    }
    try {
      const result = await this.updateNanobook.execute(
        locals.currentUserId,
        params.nanobookId ?? "",
        body
      );
      if (!result.isSuccess) return failure(result.getError());
      const book = result.getValue();
      return Response.json({
        id: book.getId(),
        name: book.getName(),
        slug: book.getSlug(),
        visibility: book.getVisibility(),
      });
    } catch {
      return jsonError("No fue posible editar el nanobook", 500);
    }
  };

  delete: APIRoute = async ({ request, locals, params }) => {
    if (!locals.currentUserId) return jsonError("Autenticación requerida", 401);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError("JSON inválido", 400);
    }
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).some((key) => key !== "confirmationName")
    ) {
      return jsonError("Solicitud inválida", 400);
    }
    try {
      const result = await this.deleteNanobook.execute(
        locals.currentUserId,
        params.nanobookId ?? "",
        (body as { confirmationName?: unknown }).confirmationName
      );
      return result.isSuccess
        ? new Response(null, { status: 204 })
        : failure(result.getError());
    } catch {
      return jsonError("No fue posible eliminar el nanobook", 500);
    }
  };
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}
function failure(error: Error) {
  const statuses: Record<string, number> = {
    NanobookAccessDeniedError: 403,
    NanobookNotFoundError: 404,
    NanobookSlugAlreadyTakenError: 409,
    InvalidNanobookError: 400,
    InvalidNanobookSlugError: 400,
  };
  const status = statuses[error.name] ?? 500;
  return jsonError(
    status === 500
      ? "No fue posible guardar los cambios; recarga la página e inténtalo de nuevo"
      : error.message,
    status
  );
}
