import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GitHubRepository } from "../github-repository";
import { buildDocument } from "../document-builder";
import { parseFrontmatter } from "../../../parse/frontmatter";

const SAMPLE_MARKDOWN = `---\ntitle: Post\ndescription: Desc\ndate: 2026-01-01\nauthor: Author\n---\n\n# Post`;

function createSampleDocument(id = "blog/post") {
  const { data, body } = parseFrontmatter(SAMPLE_MARKDOWN);
  return buildDocument(id, data, body, SAMPLE_MARKDOWN);
}

function urlMatchesPath(url: unknown, path: string): boolean {
  const urlString = url?.toString() ?? "";
  const urlPath = urlString.split("?")[0];
  return urlPath.endsWith(path);
}

function createMockResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 404,
    statusText: ok ? "OK" : "Not Found",
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  } as Response;
}

function mockFetch(body: string): typeof globalThis.fetch {
  return vi.fn(async (url) => {
    const urlString = url.toString();

    if (urlString.includes("/git/trees/")) {
      return createMockResponse({
        tree: [
          { path: "blog/post.md", type: "blob" },
          { path: "README.md", type: "blob" },
        ],
      });
    }

    return createMockResponse(body);
  });
}

describe("GitHubRepository", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    GitHubRepository.clearAllCache();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    GitHubRepository.clearAllCache();
  });

  it("lista documentos desde GitHub excluyendo README.md por defecto", async () => {
    globalThis.fetch = mockFetch(SAMPLE_MARKDOWN);

    const repository = new GitHubRepository({
      owner: "test-owner",
      repo: "test-repo",
    });

    const documents = await repository.list();

    expect(documents).toHaveLength(1);
    expect(documents.some((doc) => doc.id === "blog/post")).toBe(true);
    expect(documents.some((doc) => doc.id === "readme")).toBe(false);
  });

  it("permite incluir README.md con un pattern personalizado", async () => {
    globalThis.fetch = mockFetch(SAMPLE_MARKDOWN);

    const repository = new GitHubRepository({
      owner: "test-owner",
      repo: "test-repo",
      pattern: ["**/*.md"],
    });

    const documents = await repository.list();

    expect(documents).toHaveLength(2);
    expect(documents.some((doc) => doc.id === "blog/post")).toBe(true);
    expect(documents.some((doc) => doc.id === "readme")).toBe(true);
  });

  it("cachea la lista de documentos globalmente entre instancias", async () => {
    const fetchMock = mockFetch(SAMPLE_MARKDOWN);
    globalThis.fetch = fetchMock;

    const repositoryA = new GitHubRepository({
      owner: "test-owner",
      repo: "test-repo",
      cacheTtl: 60_000,
    });

    await repositoryA.list();
    expect(fetchMock).toHaveBeenCalledTimes(2); // tree + 1 file (README.md excluido)

    const repositoryB = new GitHubRepository({
      owner: "test-owner",
      repo: "test-repo",
      cacheTtl: 60_000,
    });

    await repositoryB.list();
    expect(fetchMock).toHaveBeenCalledTimes(2); // no nuevas llamadas
  });

  it("obtiene un documento por id", async () => {
    globalThis.fetch = vi.fn(async (url) => {
      const urlString = url.toString();

      if (urlString.includes("/git/trees/")) {
        return createMockResponse({
          tree: [{ path: "blog/post.md", type: "blob" }],
        });
      }

      return createMockResponse(SAMPLE_MARKDOWN);
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

  it("actualiza un documento existente en GitHub", async () => {
    const fetchMock = vi.fn(async (url, init) => {
      if (urlMatchesPath(url, "/contents/blog%2Fpost.md")) {
        if (init?.method === "PUT") {
          return createMockResponse({ commit: { sha: "abc123" } });
        }
        return createMockResponse({ sha: "existing-sha" });
      }

      return createMockResponse({}, false);
    });
    globalThis.fetch = fetchMock;

    const repository = new GitHubRepository({
      owner: "test-owner",
      repo: "test-repo",
    });

    await repository.save(createSampleDocument());

    const putCall = fetchMock.mock.calls.find((call) => {
      const init = call[1] as RequestInit | undefined;
      return init?.method === "PUT";
    });
    expect(putCall).toBeDefined();

    const putInit = putCall![1] as RequestInit;
    const body = JSON.parse(putInit.body as string);
    expect(body.sha).toBe("existing-sha");
    expect(body.branch).toBe("main");
    expect(body.message).toBe("Update blog/post.md");
    expect(Buffer.from(body.content, "base64").toString("utf-8")).toBe(
      SAMPLE_MARKDOWN,
    );
  });

  it("crea un documento nuevo en GitHub cuando no existe", async () => {
    const fetchMock = vi.fn(async (url, init) => {
      if (urlMatchesPath(url, "/contents/blog%2Fpost.md")) {
        if (init?.method === "PUT") {
          return createMockResponse({ commit: { sha: "abc123" } });
        }
        return createMockResponse({ message: "Not Found" }, false);
      }

      return createMockResponse({}, false);
    });
    globalThis.fetch = fetchMock;

    const repository = new GitHubRepository({
      owner: "test-owner",
      repo: "test-repo",
    });

    await repository.save(createSampleDocument());

    const putCall = fetchMock.mock.calls.find((call) => {
      const init = call[1] as RequestInit | undefined;
      return init?.method === "PUT";
    });
    expect(putCall).toBeDefined();

    const putInit = putCall![1] as RequestInit;
    const body = JSON.parse(putInit.body as string);
    expect(body.sha).toBeUndefined();
    expect(body.branch).toBe("main");
    expect(Buffer.from(body.content, "base64").toString("utf-8")).toBe(
      SAMPLE_MARKDOWN,
    );
  });

  it("usa el path base configurado al guardar", async () => {
    const fetchMock = vi.fn(async (url, init) => {
      if (urlMatchesPath(url, "/contents/docs%2Fblog%2Fpost.md")) {
        if (init?.method === "PUT") {
          return createMockResponse({ commit: { sha: "abc123" } });
        }
        return createMockResponse({ sha: "existing-sha" });
      }

      return createMockResponse({}, false);
    });
    globalThis.fetch = fetchMock;

    const repository = new GitHubRepository({
      owner: "test-owner",
      repo: "test-repo",
      path: "docs",
    });

    await repository.save(createSampleDocument());

    const putCall = fetchMock.mock.calls.find((call) => {
      const init = call[1] as RequestInit | undefined;
      return init?.method === "PUT";
    });
    expect(putCall).toBeDefined();
    expect(putCall![0].toString()).toContain("/contents/docs%2Fblog%2Fpost.md");
  });

  it("invalida el cache de documentos después de guardar", async () => {
    globalThis.fetch = vi.fn(async (url, init) => {
      const urlString = url.toString();

      if (urlString.includes("/git/trees/")) {
        return createMockResponse({
          tree: [{ path: "blog/post.md", type: "blob" }],
        });
      }

      if (urlMatchesPath(url, "/contents/blog%2Fpost.md")) {
        if (init?.method === "PUT") {
          return createMockResponse({ commit: { sha: "abc123" } });
        }
        return createMockResponse({ sha: "existing-sha" });
      }

      if (urlString.includes("raw.githubusercontent.com")) {
        return createMockResponse(SAMPLE_MARKDOWN);
      }

      return createMockResponse({}, false);
    });

    const repository = new GitHubRepository({
      owner: "test-owner",
      repo: "test-repo",
      cacheTtl: 60_000,
    });

    await repository.list();
    await repository.save(createSampleDocument());

    // Después de guardar, el cache debe estar invalidado.
    const fetchCallsBeforeReList = (globalThis.fetch as any).mock.calls.length;
    await repository.list();
    expect((globalThis.fetch as any).mock.calls.length).toBeGreaterThan(
      fetchCallsBeforeReList,
    );
  });
});
