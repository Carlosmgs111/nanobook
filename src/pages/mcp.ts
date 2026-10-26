import type { APIRoute } from "astro";
import { requireMcpAuth } from "@better-auth/mcp";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { BETTER_AUTH_URL } from "astro:env/server";
import { getApp } from "../application/server/Application";
import { getMcpOAuthConfig } from "../auth/server/infrastructure/better-auth/McpOAuthConfig";
import { readMcpActor } from "../agents/server/infrastructure/oauth/McpActorReader";
import { createNanobookMcpServer } from "../agents/server/infrastructure/mcp/createNanobookMcpServer";

export const prerender = false;

const app = await getApp();
const resource = getMcpOAuthConfig(BETTER_AUTH_URL ?? "http://127.0.0.1:4322").resource;

export const POST: APIRoute = ({ request }) => requireMcpAuth(
  app.authServerModule.auth,
  async (protectedRequest, claims) => {
    const actor = readMcpActor(claims);
    const handler = createMcpHandler(
      () => createNanobookMcpServer(actor, app.agentModule.tools),
      { legacy: "stateless", responseMode: "json" },
    );
    return handler.fetch(protectedRequest);
  },
  { resource, challengeScopes: ["nanobooks:read"] },
)(request);
