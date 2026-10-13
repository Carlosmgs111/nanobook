import { AuthorizeNanobook } from "../../nanobooks/server";
import type { Application } from "./Application";
import type { NanobookContext } from "../../nanobooks/server";

export async function resolveNanobookRoute(
  app: Application,
  request: Request,
  slug: string | undefined,
  permission: "read" | "write",
): Promise<NanobookContext | Response> {
  if (!slug) return new Response("Nanobook not found", { status: 404 });

  const context = await app.nanobookModule.forNanobookSlug(slug);
  if (!context) return new Response("Nanobook not found", { status: 404 });

  const user = await app.authServerModule.getSession(request);
  const authorization = new AuthorizeNanobook();
  if (permission === "read" && authorization.canRead(context.nanobook, user?.id)) {
    return context;
  }
  if (permission === "write" && authorization.canWrite(context.nanobook, user?.id)) {
    return context;
  }

  return new Response(
    permission === "read" ? "Nanobook not found" : "Autenticación requerida",
    { status: permission === "read" ? 404 : user ? 403 : 401 },
  );
}
