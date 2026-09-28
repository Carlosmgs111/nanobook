import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("astro:env/server", () => ({
  GITHUB_WEBHOOK_SECRET: "test-secret",
  GITHUB_BRANCH: "main",
  GITHUB_PATH: "content",
}));

import { GitHubWebhookHandler } from "./GithubWebhookHandler";
import { Result } from "../../shared/domain/Result";

function signedHeaders(body: string): Headers {
  const signature = createHmac("sha256", "test-secret")
    .update(body)
    .digest("hex");
  return new Headers({ "X-Hub-Signature-256": `sha256=${signature}` });
}

describe("GithubWebhookHandler", () => {
  it("refreshes navigation after a valid push before invalidating pages", async () => {
    const body = JSON.stringify({
      ref: "refs/heads/main",
      commits: [{ added: ["content/guides/new.md"], removed: [], modified: [] }],
    });
    const calls: string[] = [];
    const navigationService = {
      getDocumentIdByPath: vi.fn((path: string) => {
        calls.push(`resolve:${path}`);
        return path === "guides" ? "guides-id" : undefined;
      }),
      getInvalidatedIds: vi.fn(() => {
        calls.push("invalidate-ids");
        return { invalidatedIds: ["guides-id"], addedIds: [], removedIds: [] };
      }),
    };
    const renderedPageCache = {
      invalidate: vi.fn(async () => {
        calls.push("invalidate-pages");
        return Result.ok();
      }),
    };
    const refreshNavigation = vi.fn(async () => {
      calls.push("refresh-navigation");
    });

    const result = await new GitHubWebhookHandler(
      renderedPageCache,
      navigationService,
      refreshNavigation
    ).handle({ headers: signedHeaders(body), body });

    expect(result.invalidatedIds).toEqual(["guides-id"]);
    expect(refreshNavigation).toHaveBeenCalledOnce();
    expect(calls.indexOf("refresh-navigation")).toBeGreaterThan(
      calls.indexOf("invalidate-ids")
    );
    expect(calls.indexOf("refresh-navigation")).toBeLessThan(
      calls.indexOf("invalidate-pages")
    );
  });
});
