export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthenticatedSession {
  token: string;
  user: AuthenticatedUser;
}

export interface AuthSessionStorage {
  save(session: AuthenticatedSession): void;
  load(): AuthenticatedSession | null;
}

const sessionKey = "nanobook:auth:session";

export class LocalStorageAuthSessionStorage implements AuthSessionStorage {
  constructor(private readonly storage: Storage = globalThis.localStorage) {}

  save(session: AuthenticatedSession): void {
    this.storage.setItem(sessionKey, JSON.stringify(session));
  }

  load(): AuthenticatedSession | null {
    try {
      const raw = this.storage.getItem(sessionKey);
      if (!raw) return null;

      const session = JSON.parse(raw) as unknown;
      return isAuthenticatedSession(session) ? session : null;
    } catch {
      return null;
    }
  }
}

function isAuthenticatedSession(value: unknown): value is AuthenticatedSession {
  if (!isRecord(value) || typeof value.token !== "string" || !isRecord(value.user)) {
    return false;
  }

  const { id, name, email } = value.user;
  return typeof id === "string" && typeof name === "string" && typeof email === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
