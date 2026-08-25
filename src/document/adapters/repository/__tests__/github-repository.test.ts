import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GitHubRepository } from "../github-repository";

function createMockResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 404,
    statusText: ok ? "OK" : "Not Found",
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe("GitHubRepository", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("lista documentos desde GitHub", async () => {
    globalThis.fetch = vi.fn(async (url) => {
      const urlString = url.toString();

      if (urlString.includes("/git/trees/")) {
        return createMockResponse({
          tree: [
            { path: "blog/post.md", type: "blob" },
            { path: "README.md", type: "blob" },
          ],
        });
      }

      return createMockResponse({
        content: Buffer.from(
          "---\ntitle: Post\ndescription: Desc\ndate: 2026-01-01\nauthor: Author\n---\n\n# Post",
        ).toString("base64"),
        encoding: "base64",
      });
    });

    const repository = new GitHubRepository({
      owner: "test-owner",
      repo: "test-repo",
    });

    const documents = await repository.list();

    expect(documents).toHaveLength(2);
    expect(documents.some((doc) => doc.id === "blog/post")).toBe(true);
    expect(documents.some((doc) => doc.id === "readme")).toBe(true);
  });

  it("obtiene un documento por id", async () => {
    globalThis.fetch = vi.fn(async (url) => {
      const urlString = url.toString();

      if (urlString.includes("/git/trees/")) {
        return createMockResponse({
          tree: [{ path: "blog/post.md", type: "blob" }],
        });
      }

      return createMockResponse({
        content: Buffer.from(
          "---\ntitle: Post\ndescription: Desc\ndate: 2026-01-01\nauthor: Author\n---\n\n# Post",
        ).toString("base64"),
        encoding: "base64",
      });
    });

    const repository = new GitHubRepository({
      owner: "test-owner",
      repo: "test-repo",
    });

    const document = await repository.get("blog/post");

    expect(document).not.toBeNull();
    expect(document?.title).toBe("Post");
    expect(document?.content.trim()).toBe("# Post");
  });

  it("devuelve null para documento inexistente", async () => {
    globalThis.fetch = vi.fn(async () => {
      return createMockResponse({
        tree: [],
      });
    });

    const repository = new GitHubRepository({
      owner: "test-owner",
      repo: "test-repo",
    });

    const document = await repository.get("missing");
    expect(document).toBeNull();
  });

  it("lanza error al intentar guardar", async () => {
    globalThis.fetch = vi.fn();

    const repository = new GitHubRepository({
      owner: "test-owner",
      repo: "test-repo",
    });

    await expect(repository.save({} as any)).rejects.toThrow(
      "GitHubRepository does not support saving documents.",
    );
  });
});
