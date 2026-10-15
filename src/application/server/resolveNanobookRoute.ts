import { AuthorizeNanobook } from "../../nanobooks/server";
import type { Application } from "./Application";
import type { Nanobook } from "../../nanobooks/server";

export async function resolveNanobookRoute(
  app: Application,
  request: Request,
  slug: string | undefined,
  permission: "read" | "write",
): Promise<Nanobook | Response> {
  if (!slug) return new Response("Nanobook not found", { status: 404 });

  const result = await app.nanobookModule.getNanobookBySlug.execute(slug);
  if (!result.isSuccess) throw result.getError();
  const nanobook = result.getValue();
  if (!nanobook) return new Response("Nanobook not found", { status: 404 });

  const user = await app.authServerModule.getSession(request);
  const authorization = new AuthorizeNanobook();
  if (permission === "read" && authorization.canRead(nanobook, user?.id)) {
    return nanobook;
  }
  if (permission === "write" && authorization.canWrite(nanobook, user?.id)) {
    return nanobook;
  }

  return new Response(
    permission === "read" ? "Nanobook not found" : "Autenticación requerida",
    { status: permission === "read" ? 404 : user ? 403 : 401 },
  );
}
