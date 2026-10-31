import { AuthorizeNanobook } from "../../nanobooks/server/application/AuthorizeNanobook";
import type { Application } from "./Application";
import type { Nanobook } from "../../nanobooks/server/domain/Nanobook";

export interface ResolvedNanobookRoute {
  nanobook: Nanobook;
  userId: string | undefined;
}

export async function resolveNanobookRoute(
  app: Application,
  request: Request,
  slug: string | undefined,
  permission: "read" | "write",
): Promise<ResolvedNanobookRoute | Response> {
  if (!slug) return new Response("Nanobook not found", { status: 404 });

  const result = await app.nanobookModule.getNanobookBySlug.execute(slug);
  if (!result.isSuccess) throw result.getError();
  const nanobook = result.getValue();
  if (!nanobook) return new Response("Nanobook not found", { status: 404 });

  const user = await app.authServerModule.getSession(request);
  const authorization = new AuthorizeNanobook();
  if (permission === "read" && authorization.canRead(nanobook, user?.id)) {
    return { nanobook, userId: user?.id };
  }
  if (permission === "write" && authorization.canWrite(nanobook, user?.id)) {
    return { nanobook, userId: user?.id };
  }

  return new Response(
    permission === "read" ? "Nanobook not found" : "Autenticación requerida",
    { status: permission === "read" ? 404 : user ? 403 : 401 },
  );
}
