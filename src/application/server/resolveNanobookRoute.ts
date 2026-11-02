import { AuthorizeNanobook } from "../../nanobooks/server/application/AuthorizeNanobook";
import type { Application } from "./Application";
import type { Nanobook } from "../../nanobooks/server/domain/Nanobook";
import type { AuthenticatedUser } from "../../auth/browser/model/AuthSession";

export interface ResolvedNanobookRoute {
  nanobook: Nanobook;
  user: AuthenticatedUser | null;
}

export type NanobookRouteTimingObserver = (
  name: "route-nanobook" | "route-session",
  duration: number,
) => void;

export async function resolveNanobookRoute(
  app: Application,
  request: Request,
  slug: string | undefined,
  permission: "read" | "write",
  observeTiming?: NanobookRouteTimingObserver,
): Promise<ResolvedNanobookRoute | Response> {
  if (!slug) return new Response("Nanobook not found", { status: 404 });

  const [result, user] = await Promise.all([
    measure("route-nanobook", observeTiming, () =>
      app.nanobookModule.getNanobookBySlug.execute(slug),
    ),
    measure("route-session", observeTiming, () => app.authServerModule.getSession(request)),
  ]);
  if (!result.isSuccess) throw result.getError();
  const nanobook = result.getValue();
  if (!nanobook) return new Response("Nanobook not found", { status: 404 });

  const authorization = new AuthorizeNanobook();
  if (permission === "read" && authorization.canRead(nanobook, user?.id)) {
    return { nanobook, user };
  }
  if (permission === "write" && authorization.canWrite(nanobook, user?.id)) {
    return { nanobook, user };
  }

  return new Response(
    permission === "read" ? "Nanobook not found" : "Autenticación requerida",
    { status: permission === "read" ? 404 : user ? 403 : 401 },
  );
}

async function measure<T>(
  name: "route-nanobook" | "route-session",
  observeTiming: NanobookRouteTimingObserver | undefined,
  operation: () => Promise<T>,
): Promise<T> {
  const startedAt = performance.now();
  try {
    return await operation();
  } finally {
    observeTiming?.(name, performance.now() - startedAt);
  }
}
