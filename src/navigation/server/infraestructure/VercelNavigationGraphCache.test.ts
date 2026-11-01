import type { RuntimeCache } from "@vercel/functions";
import { describe, expect, it, vi } from "vitest";
import { Document } from "../../../documents/server/domain/Document";
import { DocumentsGraph } from "./DocumentsGraph";
import { VercelNavigationGraphCache } from "./VercelNavigationGraphCache";

function document(path: string, id: string, title = path) {
  return Document.create(
    path,
    {
      id,
      title,
      description: path,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    },
    "# Document",
  ).getValue();
}

function runtimeCache(value: unknown): RuntimeCache {
  return {
    get: vi.fn(async () => value),
    set: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    expireTag: vi.fn(async () => undefined),
  };
}

describe("VercelNavigationGraphCache", () => {
  it("restores a cached graph without loading documents again", async () => {
    const cachedGraph = new DocumentsGraph([document("index", "book-a-root", "Cached")]);
    const cache = runtimeCache(cachedGraph.toSnapshot());
    const navigationCache = new VercelNavigationGraphCache(cache);
    const build = vi.fn(async () => new DocumentsGraph([]));

    const graph = await navigationCache.getOrCreate("book-a", build);

    expect(graph.getNodeByPath("index")?.title).toBe("Cached");
    expect(build).not.toHaveBeenCalled();
    expect(cache.get).toHaveBeenCalledExactlyOnceWith("book-a");
  });

  it("stores a rebuilt graph when the runtime cache has no entry", async () => {
    const cache = runtimeCache(null);
    const navigationCache = new VercelNavigationGraphCache(cache);
    const graph = new DocumentsGraph([document("index", "book-a-root", "Built")]);

    const result = await navigationCache.getOrCreate("book-a", async () => graph);

    expect(result.getNodeByPath("index")?.title).toBe("Built");
    expect(cache.set).toHaveBeenCalledWith(
      "book-a",
      graph.toSnapshot(),
      expect.objectContaining({ name: "navigation:book-a" }),
    );
  });

  it("replaces the runtime entry after a document mutation", async () => {
    const cache = runtimeCache(new DocumentsGraph([document("index", "book-a-root", "Old")]).toSnapshot());
    const navigationCache = new VercelNavigationGraphCache(cache);
    const freshGraph = new DocumentsGraph([document("index", "book-a-root", "Fresh")]);

    const graph = await navigationCache.refresh("book-a", async () => freshGraph);

    expect(graph.getNodeByPath("index")?.title).toBe("Fresh");
    expect(cache.set).toHaveBeenCalledWith(
      "book-a",
      freshGraph.toSnapshot(),
      expect.objectContaining({ name: "navigation:book-a" }),
    );
  });

  it("reads a graph refreshed by another function instance", async () => {
    let stored: unknown = new DocumentsGraph([
      document("index", "book-a-root", "Old"),
    ]).toSnapshot();
    const cache = runtimeCache(null);
    cache.get = vi.fn(async () => stored);
    cache.set = vi.fn(async (_key, value) => {
      stored = value;
    });
    const firstInstance = new VercelNavigationGraphCache(cache);
    const secondInstance = new VercelNavigationGraphCache(cache);

    await firstInstance.getOrCreate("book-a", async () => new DocumentsGraph([]));
    await secondInstance.refresh(
      "book-a",
      async () => new DocumentsGraph([document("index", "book-a-root", "Fresh")]),
    );
    const graph = await firstInstance.getOrCreate("book-a", async () => new DocumentsGraph([]));

    expect(graph.getNodeByPath("index")?.title).toBe("Fresh");
  });
});
