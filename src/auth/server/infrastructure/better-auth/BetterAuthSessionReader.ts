import type { AuthenticatedUser } from "../../../model/AuthSession";

interface BetterAuthSessionApi {
  api: {
    getSession(input: { headers: Headers }): Promise<unknown>;
  };
}

export class BetterAuthSessionReader {
  constructor(private readonly auth: BetterAuthSessionApi) {}

  async getSession(headers: Headers): Promise<AuthenticatedUser | null> {
    const session = await this.auth.api.getSession({ headers });
    if (!isRecord(session) || !isAuthenticatedUser(session.user)) return null;

    return session.user;
  }
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
