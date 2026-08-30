import type { APIRoute } from "astro";
import { contentRepository } from "../../../document";
import {
  handleGitHubPushWebhook,
  verifyGitHubWebhookSignature,
  type GitHubPushPayload,
} from "../../../document/change/github-webhook-handler";
import { createRenderedPageCache } from "../../../rendering/adapters/cache/factory";
import {
  GITHUB_WEBHOOK_SECRET,
  GITHUB_BRANCH,
  GITHUB_PATH,
} from "astro:env/server";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  console.log("WEBHOOK ");
  const secret = GITHUB_WEBHOOK_SECRET;

  if (!secret) {
    return new Response(
      JSON.stringify({ error: "GITHUB_WEBHOOK_SECRET not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const signature = request.headers.get("X-Hub-Signature-256") ?? "";
  const body = await request.text();

  if (!verifyGitHubWebhookSignature(secret, signature, body)) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload: GitHubPushPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const cache = createRenderedPageCache();

  const result = await handleGitHubPushWebhook(
    contentRepository,
    cache,
    payload,
    {
      secret,
      branch: GITHUB_BRANCH ?? "main",
      path: GITHUB_PATH,
    }
  );

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
