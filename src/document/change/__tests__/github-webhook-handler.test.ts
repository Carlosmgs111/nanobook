import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  verifyGitHubWebhookSignature,
  handleGitHubPushWebhook,
} from "../github-webhook-handler";
import { MemoryRepository } from "../../adapters/repository/memory-repository";
import type { RenderedPageCache, CachedPage } from "../../../rendering/model/types";

class FakeCache implements RenderedPageCache {
  private store = new Map<string, CachedPage>();

  async get(pageId: string, contentHash: string): Promise<CachedPage | null> {
    const cached = this.store.get(pageId);
    return cached && cached.contentHash === contentHash ? cached : null;
  }

  async set(pageId: string, contentHash: string, html: string): Promise<void> {
    this.store.set(pageId, {
      pageId,
      contentHash,
      html,
      renderedAt: new Date().toISOString(),
    });
  }

  async invalidate(pageIds: string[]): Promise<void> {
    for (const pageId of pageIds) {
      this.store.delete(pageId);
    }
  }

  has(pageId: string): boolean {
    return this.store.has(pageId);
  }
}

describe("verifyGitHubWebhookSignature", () => {
  it("acepta una firma valida", () => {
    const secret = "my-secret";
    const body = "hello world";
    const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

    expect(verifyGitHubWebhookSignature(secret, signature, body)).toBe(true);
  });

  it("rechaza una firma invalida", () => {
    expect(
      verifyGitHubWebhookSignature("secret", "sha256=invalid", "body"),
    ).toBe(false);
  });
});

describe("handleGitHubPushWebhook", () => {
  it("invalida documentos modificados en un push", async () => {
    const documents = [
      {
        id: "blog",
        slug: "blog",
        parentId: null,
        position: 0,
        title: "Blog",
        description: "Blog",
        content: "# Blog",
        metadata: {
          title: "Blog",
          description: "Blog",
          date: new Date(),
          author: "Author",
          tags: [],
          draft: false,
          index: true,
          position: 0,
        },
        rawFrontmatter: "",
      },
      {
        id: "blog/post",
        slug: "blog/post",
        parentId: "blog",
        position: 0,
        title: "Post",
        description: "Post",
        content: "# Post",
        metadata: {
          title: "Post",
          description: "Post",
          date: new Date(),
          author: "Author",
          tags: [],
          draft: false,
          index: false,
          position: 0,
        },
        rawFrontmatter: "",
      },
    ];

    const repository = new MemoryRepository(documents);
    const cache = new FakeCache();
    await cache.set("blog/post", "hash-a", "<p>post</p>");

    const result = await handleGitHubPushWebhook(
      repository,
      cache,
      {
        ref: "refs/heads/main",
        commits: [
          {
            added: [],
            removed: [],
            modified: ["blog/post.md"],
          },
        ],
      },
      { secret: "secret", branch: "main", path: "" },
    );

    expect(result.invalidatedIds).toContain("blog/post");
    expect(cache.has("blog/post")).toBe(false);
  });

  it("ignora pushes de otras ramas", async () => {
    const repository = new MemoryRepository([]);
    const cache = new FakeCache();

    const result = await handleGitHubPushWebhook(
      repository,
      cache,
      {
        ref: "refs/heads/other",
        commits: [{ added: ["blog/post.md"], removed: [], modified: [] }],
      },
      { secret: "secret", branch: "main", path: "" },
    );

    expect(result.invalidatedIds).toHaveLength(0);
    expect(result.message).toContain("Ignored");
  });
});
