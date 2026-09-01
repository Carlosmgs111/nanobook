import type { APIRoute } from "astro";
import type { GitHubWebhookHandler } from "../GithubWebhookHandler";

export const prerender = false;

export class WebhookController {
  constructor(private githubWebhookHandler: GitHubWebhookHandler) {}

  handle: APIRoute = async ({ request }) => {
    console.log("Webhook received");
    try {
      const { headers } = request;
      const body = await request.text();
      const result = await this.githubWebhookHandler.handle({
        headers,
        body,
      });
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      return new Response(JSON.stringify(error), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
  };
}
