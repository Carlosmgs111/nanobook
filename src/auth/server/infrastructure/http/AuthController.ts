import type { APIRoute } from "astro";

interface BetterAuthHandler {
  handler(request: Request): Response | Promise<Response>;
}

export function createAuthController(auth: BetterAuthHandler): APIRoute {
  return async ({ request }) => {
    const response = await auth.handler(request);
    return redirectBrowserNavigation(request, response);
  };
}

async function redirectBrowserNavigation(request: Request, response: Response): Promise<Response> {
  if (!isBrowserNavigation(request) || !isJson(response)) return response;

  let payload: unknown;
  try {
    payload = await response.clone().json();
  } catch {
    return response;
  }

  if (!isRedirectInstruction(payload)) return response;

  const headers = new Headers(response.headers);
  headers.set("Location", new URL(payload.url, request.url).toString());
  return new Response(null, { status: 302, headers });
}

function isBrowserNavigation(request: Request): boolean {
  return request.headers.get("sec-fetch-mode") === "navigate"
    || request.headers.get("accept")?.includes("text/html") === true;
}

function isJson(response: Response): boolean {
  return response.headers.get("content-type")?.includes("application/json") === true;
}

function isRedirectInstruction(payload: unknown): payload is { redirect: true; url: string } {
  return typeof payload === "object"
    && payload !== null
    && "redirect" in payload
    && "url" in payload
    && payload.redirect === true
    && typeof payload.url === "string";
}
