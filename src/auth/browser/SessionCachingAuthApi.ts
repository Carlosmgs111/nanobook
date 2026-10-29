import type {
  AuthApi,
  AuthSignOutApi,
  SignInRequest,
  SignInResult,
  SignUpRequest,
  SocialAuthorization,
} from "./HttpAuthApi";
import type { AuthenticatedUser } from "./model/AuthSession";
import { CachedAuthSessionReader } from "./CachedAuthSessionReader";

export class SessionCachingAuthApi implements AuthApi, AuthSignOutApi {
  constructor(
    private readonly source: AuthApi & AuthSignOutApi,
    private readonly session: CachedAuthSessionReader,
  ) {}

  async signIn(request: SignInRequest): Promise<SignInResult> {
    const result = await this.source.signIn(request);
    if ("redirectUrl" in result) {
      this.session.clearCurrentUser();
      return result;
    }

    this.session.setCurrentUser(result);
    return result;
  }

  async signUp(request: SignUpRequest): Promise<AuthenticatedUser> {
    const user = await this.source.signUp(request);
    this.session.clearCurrentUser();
    return user;
  }

  signInWithGitHub(): Promise<SocialAuthorization> {
    return this.source.signInWithGitHub();
  }

  async signOut(): Promise<void> {
    await this.source.signOut();
    this.session.clearCurrentUser();
  }
}
