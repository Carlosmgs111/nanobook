import { HttpAuthApi, type AuthApi } from "./infrastructure/http/HttpAuthApi";
import { HttpAuthSessionReader } from "./infrastructure/http/HttpAuthSessionReader";
import { CachedAuthSessionReader } from "./infrastructure/session/CachedAuthSessionReader";
import { SessionCachingAuthApi } from "./infrastructure/session/SessionCachingAuthApi";
import type {
  AuthenticatedSessionReader,
  AuthenticatedUser,
} from "../shared/AuthSession";

export class GetAuthenticatedSession {
  constructor(private readonly sessionReader: AuthenticatedSessionReader) {}

  execute(): Promise<AuthenticatedUser | null> {
    return this.sessionReader.getCurrentUser();
  }
}

class Signout {
  constructor(
    private readonly authApi: AuthApi,
    private readonly confirm: () => boolean,
    private readonly navigate: (destination: string) => void
  ) {}

  async execute(): Promise<void> {
    if (!this.confirm()) return;

    await this.authApi.signOut();
    this.navigate("/");
  }
}

export class AuthModule {
  private constructor(
    public readonly getAuthenticatedSession: GetAuthenticatedSession,
    public readonly signOut: Signout
  ) {}
  static create() {
    const authReader = new HttpAuthSessionReader();
    const sessionReader = new CachedAuthSessionReader(authReader);
    const authApi = new SessionCachingAuthApi(new HttpAuthApi(), sessionReader);
    const signOut = new Signout(
      authApi,
      () => globalThis.confirm("¿Seguro que deseas cerrar sesión?"),
      // A fresh URL bypasses redirects cached for /; reload clears client state.
      (destination) =>
        globalThis.location.replace(`${destination}?signed-out=${Date.now()}`)
    );
    const getAuthenticatedSession = new GetAuthenticatedSession(sessionReader);
    return new AuthModule(getAuthenticatedSession, signOut);
  }
}
