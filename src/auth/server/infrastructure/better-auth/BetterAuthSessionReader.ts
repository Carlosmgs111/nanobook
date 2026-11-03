import type { AuthenticatedUser } from "../../../shared/AuthSession";

interface BetterAuthSessionApi {
  api: {
    getSession(input: {
      headers: Headers;
      query?: { disableCookieCache: true };
    }): Promise<unknown>;
  };
  handler?(request: Request): Response | Promise<Response>;
}

interface SessionReadOptions {
  forceDatabase?: boolean;
}

export class BetterAuthSessionReader {
  constructor(private readonly auth: BetterAuthSessionApi) {}

  async getSession(
    headers: Headers,
    { forceDatabase = false }: SessionReadOptions = {},
  ): Promise<AuthenticatedUser | null> {
    const session = await this.auth.api.getSession(
      forceDatabase
        ? { headers, query: { disableCookieCache: true } }
        : { headers },
    );
    if (!isRecord(session) || !isAuthenticatedUser(session.user)) return null;

    return session.user;
  }

  async getSessionForPage(
    request: Request,
    responseHeaders: Headers,
  ): Promise<AuthenticatedUser | null> {
    if (!this.auth.handler) return this.getSession(request.headers);

    const sessionUrl = new URL("/api/auth/get-session", request.url);
    const response = await this.auth.handler(
      new Request(sessionUrl, { headers: request.headers }),
    );
    forwardSetCookies(response.headers, responseHeaders);
    if (!response.ok) return null;

    const payload = await response.json() as unknown;
    return isRecord(payload) && isAuthenticatedUser(payload.user) ? payload.user : null;
  }
}

function forwardSetCookies(source: Headers, target: Headers): void {
  const getSetCookie = (source as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const cookies = getSetCookie?.call(source) ?? [source.get("Set-Cookie")].filter(
    (cookie): cookie is string => Boolean(cookie),
  );

  for (const cookie of cookies) target.append("Set-Cookie", cookie);
}

function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.email === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
