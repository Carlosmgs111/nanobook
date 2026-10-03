import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import {
  BETTER_AUTH_URL,
  GITHUB_OAUTH_CLIENT_ID,
  GITHUB_OAUTH_CLIENT_SECRET,
} from "astro:env/server";

import { db } from "../../shared/infrastructure/database/drizzleDatabase";
import * as authSchema from "./DrizzleAuthSchema";
import { createGitHubOAuthProvider } from "./GitHubOAuth";

const github = createGitHubOAuthProvider({
  clientId: GITHUB_OAUTH_CLIENT_ID,
  clientSecret: GITHUB_OAUTH_CLIENT_SECRET,
});

export const auth = betterAuth({
  baseURL: BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: authSchema,
  }),

  emailAndPassword: {
    enabled: true,
  },

  socialProviders: github ? { github } : undefined,
});
