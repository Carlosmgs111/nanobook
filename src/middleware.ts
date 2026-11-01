import { defineMiddleware } from "astro:middleware";

import { rejectCrossOriginBrowserMutation } from "./shared/server/http/BrowserMutationOriginGuard";
import { appendServerTiming } from "./shared/server/http/ServerTiming";

export const onRequest = defineMiddleware(async (context, next) => {
  if (context.url.pathname.startsWith("/api/auth/")) {
    return measureApplication(next);
  }

  const configuredOrigin = process.env.BETTER_AUTH_URL;
  const trustedOrigin = configuredOrigin
    ? new URL(configuredOrigin).origin
    : context.url.origin;
  const rejection = rejectCrossOriginBrowserMutation(
    context.request,
    trustedOrigin,
  );

  return rejection ?? measureApplication(next);
});

async function measureApplication(next: () => Promise<Response>): Promise<Response> {
  const startedAt = performance.now();
  const response = await next();
  response.headers.set(
    "Server-Timing",
    appendServerTiming(response.headers.get("Server-Timing"), {
      "app-total": performance.now() - startedAt,
    }),
  );
  return response;
}
