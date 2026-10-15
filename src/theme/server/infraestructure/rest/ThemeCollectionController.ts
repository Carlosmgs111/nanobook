import type { APIRoute } from "astro";
import type { CreateTheme } from "../../application/CreateTheme";
import type { ListThemes } from "../../application/ListThemes";
import { json, responseForError } from "./responses";

export class ThemeCollectionController {
  constructor(
    private readonly listThemes: Pick<ListThemes, "execute">,
    private readonly createTheme: Pick<CreateTheme, "execute">,
  ) {}

  get: APIRoute = async ({ locals }) => {
    if (!locals.currentUserId) return json({ error: "Autenticación requerida" }, 401);
    const result = await this.listThemes.execute(locals.currentUserId);
    return result.isSuccess ? json(result.getValue(), 200) : responseForError(result.getError());
  };

  post: APIRoute = async ({ request, locals }) => {
    if (!locals.currentUserId) return json({ error: "Autenticación requerida" }, 401);
    try {
      const body = await request.json();
      if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => !["name", "baseThemeId", "tokens"].includes(key))) return json({ error: "Solicitud inválida" }, 400);
      const result = await this.createTheme.execute(locals.currentUserId, body);
      return result.isSuccess ? json(result.getValue(), 201) : responseForError(result.getError());
    } catch {
      return json({ error: "JSON inválido" }, 400);
    }
  };
}
