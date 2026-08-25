import { describe, it, expect } from "vitest";
import { invalidateCache } from "../invalidate-handler";
import { MemoryRepository } from "../../adapters/repository/memory-repository";
import type { RenderedPageCache, CachedPage } from "../../../rendering/model/types";
import type { DocumentChange } from "../../../navigation/model/types";

class FakeCache implements RenderedPageCache {
  private store = new Map<string, CachedPage>();

  async get(pageId: string, contentHash: string): Promise<CachedPage | null> {
    const cached = this.store.get(pageId);
    return cached && cached.contentHash === contentHash ? cached : null;
  }

  async set(
    pageId: string,
    contentHash: string,
    html: string,
  ): Promise<void> {
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

describe("invalidateCache", () => {
  it("invalida documentos modificados", async () => {
    const documents = [
      {
        id: "index",
        slug: "",
        parentId: null,
        position: 0,
        title: "Inicio",
        description: "Home",
        content: "# Home",
        metadata: {
          title: "Inicio",
          description: "Home",
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
        id: "child",
        slug: "child",
        parentId: "index",
        position: 0,
        title: "Child",
        description: "Child",
        content: "# Child",
        metadata: {
          title: "Child",
          description: "Child",
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
    await cache.set("child", "hash-a", "<p>child</p>");

    const changes: DocumentChange[] = [
      { id: "child", kind: "modified", scope: "content" },
    ];

    const result = await invalidateCache(repository, cache, { changes });

    expect(result.invalidatedIds).toContain("child");
    expect(cache.has("child")).toBe(false);
  });

  it("no invalida nada cuando no hay cambios", async () => {
    const repository = new MemoryRepository([]);
    const cache = new FakeCache();

    const result = await invalidateCache(repository, cache, { changes: [] });

    expect(result.invalidatedIds).toHaveLength(0);
  });
});
