import type { APIRoute } from "astro";
import { createContentRepository } from "../../../document/adapters/repository/factory";
import {
  handleGitHubPushWebhook,
  verifyGitHubWebhookSignature,
  type GitHubPushPayload,
} from "../../../document/change/github-webhook-handler";
import { createRenderedPageCache } from "../../../rendering/adapters/cache/factory";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!secret) {
    return new Response(
      JSON.stringify({ error: "GITHUB_WEBHOOK_SECRET not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const signature = request.headers.get("X-Hub-Signature-256") ?? "";
  const body = await request.text();

  if (!verifyGitHubWebhookSignature(secret, signature, body)) {
    return new Response(
      JSON.stringify({ error: "Invalid signature" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  let payload: GitHubPushPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const repository = await createContentRepository();
  const cache = createRenderedPageCache();

  const result = await handleGitHubPushWebhook(repository, cache, payload, {
    secret,
    branch: process.env.GITHUB_BRANCH ?? "main",
    path: process.env.GITHUB_PATH,
  });

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
