import { describe, it, expect } from "vitest";
import { buildNewDocument } from "../../../shared/utils/document-builder";

describe("buildNewDocument", () => {
  it("crea un documento con valores por defecto", () => {
    const document = buildNewDocument("blog/post", {
      title: "Post",
      description: "Descripción",
    });

    expect(document.id).toBe("blog/post");
    expect(document.slug).toBe("blog/post");
    expect(document.parentId).toBe("blog");
    expect(document.title).toBe("Post");
    expect(document.description).toBe("Descripción");
    expect(document.metadata.index).toBe(false);
    expect(document.metadata.draft).toBe(false);
    expect(document.metadata.position).toBe(0);
    expect(document.content).toBe("");
    expect(document.rawFrontmatter).toContain("title: \"Post\"");
    expect(document.rawFrontmatter).toContain("index: false");
  });

  it("infiere index: true para ids de índice y normaliza el id", () => {
    const document = buildNewDocument("blog/index", {
      title: "Blog",
      description: "Índice del blog",
    });

    expect(document.id).toBe("blog");
    expect(document.slug).toBe("blog");
    expect(document.parentId).toBe("index");
    expect(document.metadata.index).toBe(true);
    expect(document.rawFrontmatter).toContain("index: true");
  });

  it("acepta overrides de metadata", () => {
    const document = buildNewDocument("blog/post", {
      title: "Post",
      description: "Descripción",
      author: "Autor",
      position: 3,
      draft: true,
      tags: ["a", "b"],
    });

    expect(document.metadata.author).toBe("Autor");
    expect(document.metadata.position).toBe(3);
    expect(document.metadata.draft).toBe(true);
    expect(document.metadata.tags).toEqual(["a", "b"]);
  });

  it("rechaza inconsistencia de índice", () => {
    expect(() =>
      buildNewDocument("blog/post", {
        title: "Post",
        description: "Desc",
        index: true,
      }),
    ).toThrow();

    expect(() =>
      buildNewDocument("blog/index", {
        title: "Blog",
        description: "Desc",
        index: false,
      }),
    ).toThrow();
  });
});
