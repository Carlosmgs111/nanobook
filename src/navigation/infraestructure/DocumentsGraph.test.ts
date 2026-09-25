import { describe, expect, it } from "vitest";
import { Document } from "../../document/domain/Document";
import { DocumentsGraph } from "./DocumentsGraph";

function document(path: string, id: string, index: boolean) {
  return Document.create(
    path,
    {
      id,
      title: path,
      description: path,
      date: new Date("2026-01-01"),
      index,
    },
    "# Document"
  ).getValue();
}

describe("DocumentsGraph", () => {
  it("indexes nodes and dependency edges by stable identity", () => {
    const root = document("index", "doc-root", true);
    const section = document("guides/index", "doc-guides", true);
    const child = document("guides/cache", "doc-cache", false);
    const graph = new DocumentsGraph([root, section, child]);

    expect(graph.getNode("doc-cache")?.path).toBe("guides/cache");
    expect(graph.getNodeByPath("guides/cache")?.id).toBe("doc-cache");
    expect(graph.getParent("doc-cache")?.id).toBe("doc-guides");
  });
});
