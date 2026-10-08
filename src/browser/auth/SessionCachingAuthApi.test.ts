import { describe, expect, it, vi } from "vitest";

import type {
  AuthApi,
  AuthSignOutApi,
  SignInRequest,
  SignUpRequest,
  SocialAuthorization,
} from "./HttpAuthApi";
import { CachedAuthSessionReader } from "./CachedAuthSessionReader";
import { SessionCachingAuthApi } from "./SessionCachingAuthApi";

const ada = {
  id: "user-1",
  name: "Ada Lovelace",
  email: "ada@example.com",
};

class FakeAuthApi implements AuthApi, AuthSignOutApi {
  readonly sessionReader = { getCurrentUser: vi.fn().mockResolvedValue(null) };

  async signIn(_request: SignInRequest) {
    return ada;
  }

  async signUp(_request: SignUpRequest) {
    return ada;
  }

  async signInWithGitHub(): Promise<SocialAuthorization> {
    return { authorizationUrl: "https://github.com/login" };
  }

  async signOut(): Promise<void> {}
}

describe("SessionCachingAuthApi", () => {
  it("makes a successful sign-in available without another session request", async () => {
    const source = new FakeAuthApi();
    const session = new CachedAuthSessionReader(source.sessionReader);
    const authApi = new SessionCachingAuthApi(source, session);

    await authApi.signIn({ email: "ada@example.com", password: "password" });

    await expect(session.getCurrentUser()).resolves.toEqual(ada);
    expect(source.sessionReader.getCurrentUser).not.toHaveBeenCalled();
  });

  it("clears the browser session state after sign-out", async () => {
    const source = new FakeAuthApi();
    const session = new CachedAuthSessionReader(source.sessionReader);
    const authApi = new SessionCachingAuthApi(source, session);
    session.setCurrentUser(ada);

    await authApi.signOut();

    await expect(session.getCurrentUser()).resolves.toBeNull();
    expect(source.sessionReader.getCurrentUser).not.toHaveBeenCalled();
  });
});
