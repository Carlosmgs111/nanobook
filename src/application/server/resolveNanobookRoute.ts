import { Subject } from "../../authorization/server";
import type { Application } from "./Application";
import type { Nanobook } from "../../nanobooks/server/domain/Nanobook";
import type { AuthenticatedUser } from "../../auth/shared/AuthSession";

export interface ResolvedNanobookRoute {
  nanobook: Nanobook;
  user: AuthenticatedUser | null;
}

export type NanobookRouteTimingObserver = (
  name: "route-nanobook" | "route-session",
  duration: number,
) => void;

const BODIES = {
  401: "Autenticación requerida",
  403: "No tienes permiso de edición sobre el nanobook",
  404: "Nanobook not found",
} as const;

export async function resolveNanobookRoute(
  app: Application,
  request: Request,
  slug: string | undefined,
  permission: "read" | "write",
  observeTiming?: NanobookRouteTimingObserver,
  responseHeaders?: Headers,
): Promise<ResolvedNanobookRoute | Response> {
  if (!slug) return new Response("Nanobook not found", { status: 404 });

  const resolveSession = () =>
    measure("route-session", observeTiming, () =>
      app.authServerModule.getSession(request, responseHeaders),
    );

  // En escritura se exige sesión antes de consultar el slug, para no revelar su existencia.
  let user: AuthenticatedUser | null = null;
  if (permission === "write") {
    user = await resolveSession();
    if (!user) return new Response(BODIES[401], { status: 401 });
  }

  const result = await measure("route-nanobook", observeTiming, () =>
    app.nanobookModule.getNanobookBySlug.execute(slug),
  );
  if (!result.isSuccess) throw result.getError();
  const nanobook = result.getValue();
  if (!nanobook) return new Response(BODIES[404], { status: 404 });

  if (permission === "read") {
    if (nanobook.getVisibility() === "public") return { nanobook, user: null };
    user = await resolveSession();
  }

  const decision = await app.authorizer.authorize({
    subject: Subject.of(user?.id),
    action: permission,
    resource: { type: "nanobook", id: nanobook.getId() },
  });
  if (decision.effect === "allow") return { nanobook, user };

  const status: keyof typeof BODIES =
    permission === "read" || decision.effect !== "deny"
      ? 404
      : ({ unauthenticated: 401, forbidden: 403, "not-found": 404 } as const)[decision.reason];
  return new Response(BODIES[status], { status });
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
