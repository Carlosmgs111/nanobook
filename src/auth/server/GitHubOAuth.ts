export interface GitHubOAuthCredentials {
  clientId?: string;
  clientSecret?: string;
}

export interface GitHubOAuthProvider {
  clientId: string;
  clientSecret: string;
}

export function createGitHubOAuthProvider(
  credentials: GitHubOAuthCredentials,
): GitHubOAuthProvider | undefined {
  const { clientId, clientSecret } = credentials;

  if (!clientId && !clientSecret) return undefined;

  if (!clientId || !clientSecret) {
    throw new Error(
      "GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET must be configured together.",
    );
  }

  return { clientId, clientSecret };
}

export function isGitHubOAuthEnabled(
  credentials: GitHubOAuthCredentials,
): boolean {
  return createGitHubOAuthProvider(credentials) !== undefined;
}
