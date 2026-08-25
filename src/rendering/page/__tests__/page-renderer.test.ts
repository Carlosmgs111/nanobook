import { describe, it, expect } from "vitest";
import { PageRenderer } from "../page-renderer";
import { MemoryRepository } from "../../../document/adapters/repository/memory-repository";
import type {
  CachedPage,
  DocumentRenderer,
  RenderedDocument,
  RenderedPageCache,
} from "../../model/types";

class FakeRenderer implements DocumentRenderer {
  async render(): Promise<RenderedDocument> {
    return {
      Content: "<p>rendered</p>",
    };
  }
}

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
}

describe("PageRenderer", () => {
  it("renderiza un documento existente", async () => {
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

    const renderer = new PageRenderer(
      new MemoryRepository(documents),
      new FakeRenderer(),
    );
    const result = await renderer.render("child");

    expect(result).not.toBeNull();
    expect(result?.pageId).toBe("child");
    expect(result?.renderedBody).toBe("<p>rendered</p>");
    expect(result?.breadcrumbs.some((crumb) => crumb.id === "child")).toBe(
      true,
    );
  });

  it("devuelve null para un documento inexistente", async () => {
    const renderer = new PageRenderer(
      new MemoryRepository([]),
      new FakeRenderer(),
    );
    const result = await renderer.render("missing");

    expect(result).toBeNull();
  });

  it("usa el cache de cuerpos cuando se proporciona contentHash", async () => {
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
    ];

    const cache = new FakeCache();
    await cache.set("index", "hash-a", "<p>cached</p>");

    const renderer = new PageRenderer(
      new MemoryRepository(documents),
      new FakeRenderer(),
      cache,
    );

    const result = await renderer.render("index", "hash-a");

    expect(result?.renderedBody).toBe("<p>cached</p>");
  });

  it("renderiza y guarda en cache cuando no hay entrada cacheada", async () => {
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
    ];

    const cache = new FakeCache();
    const renderer = new PageRenderer(
      new MemoryRepository(documents),
      new FakeRenderer(),
      cache,
    );

    const result = await renderer.render("index", "hash-b");

    expect(result?.renderedBody).toBe("<p>rendered</p>");
    const cached = await cache.get("index", "hash-b");
    expect(cached?.html).toBe("<p>rendered</p>");
  });
});
