import { HttpAuthApi, type AuthSignOutApi } from "./HttpAuthApi";
import { HttpAuthSessionReader } from "./HttpAuthSessionReader";
import { CachedAuthSessionReader } from "./CachedAuthSessionReader";
import { SessionCachingAuthApi } from "./SessionCachingAuthApi";
import type {
  AuthenticatedSessionReader,
  AuthenticatedUser,
} from "./model/AuthSession";

export class GetAuthenticatedSession {
  constructor(private readonly sessionReader: AuthenticatedSessionReader) {}

  execute(): Promise<AuthenticatedUser | null> {
    return this.sessionReader.getCurrentUser();
  }
}

class Signout {
  constructor(
    private readonly authApi: AuthSignOutApi,
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
    const sessionReader = new CachedAuthSessionReader(
      new HttpAuthSessionReader()
    );
    const authApi = new SessionCachingAuthApi(new HttpAuthApi(), sessionReader);
    const signOut = new Signout(
      authApi,
      () => globalThis.confirm("¿Seguro que deseas cerrar sesión?"),
      // A fresh URL bypasses redirects cached for /; reload clears client state.
      (destination) => globalThis.location.replace(`${destination}?signed-out=${Date.now()}`)
    );
    const getAuthenticatedSession = new GetAuthenticatedSession(sessionReader);
    return new AuthModule(getAuthenticatedSession, signOut);
  }
}
