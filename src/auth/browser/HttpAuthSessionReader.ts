import type {
  AuthenticatedSessionReader,
  AuthenticatedUser,
} from "../model/AuthSession";

export class HttpAuthSessionReader implements AuthenticatedSessionReader {
  async getCurrentUser(): Promise<AuthenticatedUser | null> {
    const response = await fetch("/api/auth/get-session", {
      credentials: "include",
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as unknown;
    return readUser(payload);
  }
}

function readUser(payload: unknown): AuthenticatedUser | null {
  if (!isRecord(payload) || !isRecord(payload.user)) return null;

  const { id, name, email } = payload.user;
  if (
    typeof id !== "string" ||
    typeof name !== "string" ||
    typeof email !== "string"
  ) {
    return null;
  }

  return { id, name, email };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
