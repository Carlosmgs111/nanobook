import { HttpAuthApi, type AuthApi } from "./HttpAuthApi";
import { HttpAuthSessionReader } from "./HttpAuthSessionReader";
import { CachedAuthSessionReader } from "./CachedAuthSessionReader";
import { SessionCachingAuthApi } from "./SessionCachingAuthApi";
import { navigate } from "astro:transitions/client";
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
    const sessionReader = new CachedAuthSessionReader(
      new HttpAuthSessionReader()
    );
    const authApi = new SessionCachingAuthApi(new HttpAuthApi(), sessionReader);
    const signOut = new Signout(
      authApi,
      () => globalThis.confirm("¿Seguro que deseas cerrar sesión?"),
      () => navigate("/")
    );
    const getAuthenticatedSession = new GetAuthenticatedSession(sessionReader);
    return new AuthModule(getAuthenticatedSession, signOut);
  }
}
