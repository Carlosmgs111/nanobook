import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { mcp } from "@better-auth/mcp";
import {
  BETTER_AUTH_URL,
  BETTER_AUTH_SECRET,
  EMAIL_FROM,
  GITHUB_OAUTH_CLIENT_ID,
  GITHUB_OAUTH_CLIENT_SECRET,
  RESEND_API_KEY,
} from "astro:env/server";

import { db } from "../../../../shared/infrastructure/database/drizzleDatabase";
import * as authSchema from "./DrizzleAuthSchema";
import { createGitHubOAuthProvider } from "./GitHubOAuth";
import {
  getMcpOAuthConfig,
  getTrustedApplicationOrigins,
  isCodexClientMetadataUrlAllowed,
} from "./McpOAuthConfig";
import { ResendEmailSender } from "./ResendEmailSender";

export function createBetterAuth() {
  const baseURL = BETTER_AUTH_URL ?? "http://127.0.0.1:4322";
  const mcpOAuth = getMcpOAuthConfig(baseURL);

  if (process.env.VERCEL === "1") {
    let authURL: URL;
    try {
      authURL = new URL(BETTER_AUTH_URL ?? "");
    } catch {
      throw new Error("BETTER_AUTH_URL must be an HTTPS origin on Vercel.");
    }
    if (authURL.protocol !== "https:" || authURL.pathname !== "/" || authURL.search || authURL.hash) {
      throw new Error("BETTER_AUTH_URL must be an HTTPS origin on Vercel.");
    }
    if (!BETTER_AUTH_SECRET || BETTER_AUTH_SECRET.length < 32) {
      throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters on Vercel.");
    }
    if (!RESEND_API_KEY || !EMAIL_FROM) {
      throw new Error("RESEND_API_KEY and EMAIL_FROM are required on Vercel.");
    }
  }
  const github = createGitHubOAuthProvider({
    clientId: GITHUB_OAUTH_CLIENT_ID,
    clientSecret: GITHUB_OAUTH_CLIENT_SECRET,
  });
  const emailSender = new ResendEmailSender({
    apiKey: RESEND_API_KEY,
    from: EMAIL_FROM ?? "Nanobook <onboarding@resend.dev>",
  });

  return betterAuth({
    baseURL,
    trustedOrigins: getTrustedApplicationOrigins(baseURL),
    secret: BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: authSchema,
    }),
    session: {
      expiresIn: 60 * 60 * 12,
      disableSessionRefresh: true,
    },
    rateLimit: {
      enabled: true,
      storage: "database",
    },
    advanced: process.env.VERCEL === "1" ? {
      useSecureCookies: true,
      ipAddress: { ipAddressHeaders: ["x-vercel-forwarded-for"] },
    } : undefined,

    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
    },

    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await emailSender.sendVerificationEmail({
          to: user.email,
          url: getVerificationURL(url),
        });
      },
    },

    socialProviders: github ? { github } : undefined,
    plugins: [
      jwt(),
      mcp({
        ...mcpOAuth,
        scopes: ["nanobooks:read", "nanobooks:write", "offline_access"],
        accessTokenExpiresIn: 60 * 15,
        refreshTokenExpiresIn: 60 * 60 * 24 * 30,
        refreshTokenReuseInterval: 0,
      }),
      cimd({
        fetchClientMetadataResource,
        metadataProfile: "mcp-2026-07-28",
        isMetadataDocumentUrlAllowed: isCodexClientMetadataUrlAllowed,
      }),
    ],
  });
}

function getVerificationURL(url: string): string {
  if (process.env.VERCEL !== "1" || !BETTER_AUTH_URL) return url;

  const canonicalURL = new URL(BETTER_AUTH_URL);
  const verificationURL = new URL(url, canonicalURL);
  return new URL(
    `${verificationURL.pathname}${verificationURL.search}${verificationURL.hash}`,
    canonicalURL,
  ).toString();
}
