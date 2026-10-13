import { AuthorizeNanobook } from "../../nanobooks/server";
import type { Application } from "./Application";

export async function resolveLegacyRoute(
  app: Application,
  request: Request,
  path: string | undefined,
  permission: "read" | "write",
): Promise<Response | null> {
  const alias = await app.resolveNanobookAlias(path ?? "index");
  if (!alias) return null;

  const context = await app.forNanobook(alias.nanobookId);
  const user = await app.authServerModule.getSession(request);
  const authorization = new AuthorizeNanobook();
  const allowed = permission === "read"
    ? authorization.canRead(context.nanobook, user?.id)
    : authorization.canWrite(context.nanobook, user?.id);
  if (!allowed) {
    return new Response(
      permission === "read" ? "Nanobook not found" : "Autenticación requerida",
      { status: permission === "read" ? 404 : user ? 403 : 401 },
    );
  }

  const target = alias.targetPath === "index" ? "" : `/${alias.targetPath}`;
  const location = new URL(`/n/${context.nanobook.getSlug()}${target}`, request.url);
  return Response.redirect(location, 308);
}
