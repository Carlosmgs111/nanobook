import type { APIRoute } from "astro";
import { isThemeReference } from "../../shared/theme/ThemeReference";
import type { AssignNanobookTheme } from "./AssignNanobookTheme";

export class AssignNanobookThemeController {
  constructor(private readonly assign: AssignNanobookTheme) {}
  handle: APIRoute = async ({ request, locals, params }) => {
    if (!locals.currentUserId) return json("Autenticación requerida", 401);
    if (!params.nanobookId) return json("Nanobook inválido", 400);
    try {
      const body = await request.json();
      if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => key !== "reference") || !isThemeReference(body.reference)) return json("Referencia de tema inválida", 400);
      const result = await this.assign.execute(locals.currentUserId, params.nanobookId, body.reference);
      if (result.isSuccess) return new Response(null, { status: 204 });
      const error = result.getError();
      const status = error.name.includes("AccessDenied") ? 403 : error.name.includes("NotFound") ? 404 : error.name.includes("Invalid") ? 400 : 500;
      return json(status === 500 ? "No fue posible asignar el tema" : error.message, status);
    } catch { return json("JSON inválido", 400); }
  };
}

function json(error: string, status: number) { return new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json" } }); }
