import { describe, expect, it } from "vitest";

import {
  createGitHubOAuthProvider,
  isGitHubOAuthEnabled,
} from "./GitHubOAuth";

describe("GitHub OAuth configuration", () => {
  it("does not enable GitHub when both credentials are absent", () => {
    expect(createGitHubOAuthProvider({})).toBeUndefined();
    expect(isGitHubOAuthEnabled({})).toBe(false);
  });

  it("enables GitHub only with its complete credential pair", () => {
    expect(
      createGitHubOAuthProvider({
        clientId: "client-id",
        clientSecret: "client-secret",
      }),
    ).toEqual({ clientId: "client-id", clientSecret: "client-secret" });
  });

  it("rejects a partial GitHub OAuth configuration", () => {
    expect(() =>
      createGitHubOAuthProvider({ clientId: "client-id" }),
    ).toThrow(
      "GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET must be configured together.",
    );
  });
});
