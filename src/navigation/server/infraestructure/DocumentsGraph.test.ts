import { describe, expect, it } from "vitest";
import { Document } from "../../../documents/server/domain/Document";
import { DocumentsGraph } from "./DocumentsGraph";

function document(path: string, id: string) {
  return Document.create(
    path,
    {
      id,
      title: path,
      description: path,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    },
    "# Document"
  ).getValue();
}

describe("DocumentsGraph", () => {
  it("indexes nodes and dependency edges by stable identity", () => {
    const root = document("index", "doc-root");
    const section = document("guides/index", "doc-guides");
    const child = document("guides/cache", "doc-cache");
    const graph = new DocumentsGraph([root, section, child]);

    expect(graph.getNode("doc-cache")?.path).toBe("guides/cache");
    expect(graph.getNodeByPath("guides/cache")?.id).toBe("doc-cache");
    expect(graph.getParent("doc-cache")?.id).toBe("doc-guides");
  });

  it("restores its navigation and dependency indexes from a cache snapshot", () => {
    const root = document("index", "doc-root");
    const section = document("guides/index", "doc-guides");
    const child = document("guides/cache", "doc-cache");
    const graph = new DocumentsGraph([root, section, child]);

    const restored = DocumentsGraph.fromSnapshot(graph.toSnapshot());

    expect(restored.getNodeByPath("guides/cache")?.id).toBe("doc-cache");
    expect(restored.getParent("doc-cache")?.id).toBe("doc-guides");
    expect(restored.getIncomingEdges("doc-cache")).toContainEqual({
      sourceId: "doc-guides",
      targetId: "doc-cache",
      kind: "parent-child",
    });
  });
});
