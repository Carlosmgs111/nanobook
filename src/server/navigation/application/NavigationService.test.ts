import { describe, expect, it } from "vitest";
import { Document } from "../../documents/domain/Document";
import { DocumentPath } from "../../documents/domain/DocumentPath";
import { DocumentsGraph } from "../infraestructure/DocumentsGraph";
import { NavigationService } from "./NavigationService";

function document(path: string, id: string, title: string) {
  return Document.create(
    path,
    {
      id,
      title,
      description: title,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
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
});
