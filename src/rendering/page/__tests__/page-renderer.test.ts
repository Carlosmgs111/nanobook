import { describe, it, expect } from "vitest";
import { PageRenderer } from "../page-renderer";
import { MemoryRepository } from "../../../document/adapters/repository/memory-repository";
import type { DocumentRenderer, RenderedDocument } from "../../model/types";

class FakeRenderer implements DocumentRenderer {
  async render(): Promise<RenderedDocument> {
    return {
      Content: "<p>rendered</p>",
      headings: [],
    };
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
});
