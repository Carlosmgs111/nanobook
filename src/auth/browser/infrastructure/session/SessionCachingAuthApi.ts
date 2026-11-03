import type {
  AuthApi,
  SignInRequest,
  SignInResult,
  SignUpRequest,
  SocialAuthorization,
} from "../http/HttpAuthApi";
import type { AuthenticatedUser } from "../../../shared/AuthSession";
import { CachedAuthSessionReader } from "./CachedAuthSessionReader";

export class SessionCachingAuthApi implements AuthApi {
  constructor(
    private readonly source: AuthApi,
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
