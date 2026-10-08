import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import {
  BETTER_AUTH_URL,
  EMAIL_FROM,
  GITHUB_OAUTH_CLIENT_ID,
  GITHUB_OAUTH_CLIENT_SECRET,
  RESEND_API_KEY,
} from "astro:env/server";

import { db } from "../../../../shared/infrastructure/database/drizzleDatabase";
import * as authSchema from "./DrizzleAuthSchema";
import { createGitHubOAuthProvider } from "./GitHubOAuth";
import { ResendEmailSender } from "./ResendEmailSender";

export function createBetterAuth() {
  const github = createGitHubOAuthProvider({
    clientId: GITHUB_OAUTH_CLIENT_ID,
    clientSecret: GITHUB_OAUTH_CLIENT_SECRET,
  });
  const emailSender = new ResendEmailSender({
    apiKey: RESEND_API_KEY,
    from: EMAIL_FROM ?? "Nanobook <onboarding@resend.dev>",
  });

  return betterAuth({
    baseURL: BETTER_AUTH_URL,
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: authSchema,
    }),

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
    },

    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await emailSender.sendVerificationEmail({ to: user.email, url });
      },
    },

    socialProviders: github ? { github } : undefined,
  });
}
