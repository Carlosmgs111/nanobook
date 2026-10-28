import { defineMiddleware } from "astro:middleware";

import { rejectCrossOriginBrowserMutation } from "./shared/server/http/BrowserMutationOriginGuard";

export const onRequest = defineMiddleware((context, next) => {
  if (context.url.pathname.startsWith("/api/auth/")) {
    return next();
  }

  const configuredOrigin = process.env.BETTER_AUTH_URL;
  const trustedOrigin = configuredOrigin
    ? new URL(configuredOrigin).origin
    : context.url.origin;
  const rejection = rejectCrossOriginBrowserMutation(
    context.request,
    trustedOrigin,
  );

  return rejection ?? next();
});
