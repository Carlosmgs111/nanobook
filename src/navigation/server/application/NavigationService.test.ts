import { describe, expect, it } from "vitest";
import { Document } from "../../../documents/server/domain/Document";
import { DocumentPath } from "../../../documents/server/domain/DocumentPath";
import type { DocumentMetadata } from "../../../documents/server/domain/types";
import { DocumentsGraph } from "../infraestructure/DocumentsGraph";
import { NavigationService } from "./NavigationService";

function document(
  path: string,
  id: string,
  title: string,
  metadata: Partial<DocumentMetadata> = {},
) {
  return Document.create(
    path,
    {
      id,
      title,
      description: title,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      ...metadata,
    },
    "# Document"
  ).getValue();
}

describe("NavigationService", () => {
  it("resolves a public path to the stable document id", () => {
    const folder = document("new-dir/index", "stable-folder", "New directory");
    const service = new NavigationService(new DocumentsGraph([folder]));

    expect(service.getDocumentIdByPath("new-dir")).toBe("stable-folder");
    expect(service.getDocumentIdByPath("missing")).toBeUndefined();
  });

  it("returns the stable parent id and its public path", () => {
    const root = document("index", "stable-root", "Home");
    const folder = document(
      "new-dir/index",
      "stable-folder",
      "New directory",
    );
    const child = document("new-dir/file", "stable-child", "File");
    const service = new NavigationService(
      new DocumentsGraph([root, folder, child])
    );

    expect(
      service.getParentEntry(DocumentPath.create("new-dir/file").getValue())
    ).toEqual({
      id: "stable-folder",
      path: "new-dir",
      data: { title: "New directory" },
    });
  });

  it("starts breadcrumbs from the explicit nanobook context root", () => {
    const root = document("index", "root", "Home");
    const books = document("books/index", "books", "Books");
    const programming = document("books/programming/index", "programming", "Programming");
    const nanobook = document(
      "books/programming/typescript-ddd/index",
      "typescript-ddd",
      "TypeScript DDD",
      { nanobook: true },
    );
    const chapter = document(
      "books/programming/typescript-ddd/chapter-1",
      "chapter-1",
      "Chapter 1",
    );
    const service = new NavigationService(
      new DocumentsGraph([root, books, programming, nanobook, chapter]),
      { rootPath: "books/programming/typescript-ddd" },
    );

    expect(
      service.getBreadcrumbs(
        DocumentPath.create("books/programming/typescript-ddd/index").getValue(),
      ),
    ).toEqual([
      {
        id: "books/programming/typescript-ddd",
        title: "TypeScript DDD",
        href: "/books/programming/typescript-ddd/",
        current: true,
      },
    ]);
    expect(
      service.getBreadcrumbs(
        DocumentPath.create("books/programming/typescript-ddd/chapter-1").getValue(),
      ),
    ).toEqual([
      {
        id: "books/programming/typescript-ddd",
        title: "TypeScript DDD",
        href: "/books/programming/typescript-ddd/",
        current: false,
      },
      {
        id: "books/programming/typescript-ddd/chapter-1",
        title: "Chapter 1",
        href: "/books/programming/typescript-ddd/chapter-1/",
        current: true,
      },
    ]);
  });

  it("does not expose navigation above the explicit nanobook context root", () => {
    const root = document("index", "root", "Home");
    const books = document("books/index", "books", "Books");
    const nanobook = document("books/typescript-ddd/index", "typescript-ddd", "TypeScript DDD", {
      nanobook: true,
    });
    const chapter = document("books/typescript-ddd/chapter-1", "chapter-1", "Chapter 1");
    const appendix = document("books/typescript-ddd/appendix", "appendix", "Appendix");
    const service = new NavigationService(
      new DocumentsGraph([root, books, nanobook, chapter, appendix]),
      { rootPath: "books/typescript-ddd" },
    );

    expect(
      service.getSidebarEntries(
        DocumentPath.create("books/typescript-ddd/index").getValue(),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "chapter-1", path: "books/typescript-ddd/chapter-1" }),
        expect.objectContaining({ id: "appendix", path: "books/typescript-ddd/appendix" }),
      ]),
    );
    expect(
      service.getParentEntry(
        DocumentPath.create("books/typescript-ddd/index").getValue(),
      ),
    ).toBeNull();
  });

  it("ignores legacy nanobook markers without an explicit context root", () => {
    const outer = document("books/outer/index", "outer", "Outer", { nanobook: true });
    const inner = document("books/outer/inner/index", "inner", "Inner", { nanobook: true });
    const chapter = document("books/outer/inner/chapter", "chapter", "Chapter");
    const service = new NavigationService(new DocumentsGraph([outer, inner, chapter]));

    expect(
      service.getBreadcrumbs(
        DocumentPath.create("books/outer/inner/chapter").getValue(),
      )[0],
    ).toMatchObject({ id: "index", title: "Inicio" });
  });
});
