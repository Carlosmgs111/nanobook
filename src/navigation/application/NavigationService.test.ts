import { describe, expect, it } from "vitest";
import { Document } from "../../document/domain/Document";
import { DocumentPath } from "../../document/domain/DocumentPath";
import { DocumentsGraph } from "../infraestructure/DocumentsGraph";
import { NavigationService } from "./NavigationService";

function document(path: string, id: string, title: string, index = false) {
  return Document.create(
    path,
    {
      id,
      title,
      description: title,
      date: new Date("2026-01-01"),
      index,
    },
    "# Document"
  ).getValue();
}

describe("NavigationService", () => {
  it("resolves a public path to the stable document id", () => {
    const folder = document("new-dir/index", "stable-folder", "New directory", true);
    const service = new NavigationService(new DocumentsGraph([folder]));

    expect(service.getDocumentIdByPath("new-dir")).toBe("stable-folder");
    expect(service.getDocumentIdByPath("missing")).toBeUndefined();
  });

  it("returns the stable parent id and its public path", () => {
    const root = document("index", "stable-root", "Home", true);
    const folder = document(
      "new-dir/index",
      "stable-folder",
      "New directory",
      true
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
