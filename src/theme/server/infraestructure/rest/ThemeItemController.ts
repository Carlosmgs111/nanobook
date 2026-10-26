import type { APIRoute } from "astro";
import type { GetTheme } from "../../application/GetTheme";
import type { UpdateTheme } from "../../application/UpdateTheme";
import { json, responseForError } from "./responses";

export class ThemeItemController {
  constructor(
    private readonly getTheme: GetTheme,
    private readonly updateTheme: UpdateTheme,
  ) {}

  get: APIRoute = async ({ locals, params }) => {
    if (!locals.currentUserId) return json({ error: "Autenticación requerida" }, 401);
    if (!params.themeId) return json({ error: "Tema inválido" }, 400);
    const result = await this.getTheme.execute(locals.currentUserId, params.themeId);
    return result.isSuccess ? json(result.getValue(), 200) : responseForError(result.getError());
  };

  patch: APIRoute = async ({ request, locals, params }) => {
    if (!locals.currentUserId) return json({ error: "Autenticación requerida" }, 401);
    if (!params.themeId) return json({ error: "Tema inválido" }, 400);
    try {
      const body = await request.json();
      const result = await this.updateTheme.execute(locals.currentUserId, params.themeId, body);
      return result.isSuccess ? json(result.getValue(), 200) : responseForError(result.getError());
    } catch {
      return json({ error: "JSON inválido" }, 400);
    }
  };
}
