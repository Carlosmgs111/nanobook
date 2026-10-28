export const UNSAFE_HTTP_METHODS = ["POST", "PUT", "PATCH", "DELETE"] as const;

export function rejectCrossOriginBrowserMutation(
  request: Request,
  trustedOrigin: string,
): Response | undefined {
  if (!UNSAFE_HTTP_METHODS.includes(request.method as (typeof UNSAFE_HTTP_METHODS)[number])) {
    return undefined;
  }

  const fetchSite = request.headers.get("Sec-Fetch-Site");
  if (fetchSite !== null && fetchSite !== "same-origin") {
    return new Response(null, { status: 403 });
  }

  const origin = request.headers.get("Origin");
  if (origin !== null && origin !== trustedOrigin) {
    return new Response(null, { status: 403 });
  }

  return undefined;
}
