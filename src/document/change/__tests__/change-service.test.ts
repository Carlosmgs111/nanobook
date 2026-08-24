import { describe, it, expect } from "vitest";
import { MemoryRepository } from "../../adapters/repository/memory-repository";
import { ContentChangeService } from "../change-service";
import { hashDocument } from "../snapshot";
import { createDocument } from "../../../navigation/model/__tests__/factory";

describe("ContentChangeService", () => {
  it("detecta cambios y calcula documentos invalidados", async () => {
    const previousDocs = [
      createDocument({ id: "index", slug: "", parentId: null }),
      createDocument({ id: "child", parentId: "index", title: "Old title" }),
    ];

    const currentDocs = [
      createDocument({ id: "index", slug: "", parentId: null }),
      createDocument({ id: "child", parentId: "index", title: "New title" }),
    ];

    const service = new ContentChangeService(new MemoryRepository(currentDocs));
    const previousHashes = previousDocs.map(hashDocument);

    const changes = await service.detectChanges(previousHashes);
    expect(changes).toEqual([
      { id: "child", kind: "modified", scope: "metadata" },
    ]);

    const invalidation = await service.getInvalidatedIds(changes);
    expect(invalidation.invalidatedIds).toContain("child");
    expect(invalidation.invalidatedIds).toContain("index");
  });

  it("expone el grafo de documentos", async () => {
    const docs = [
      createDocument({ id: "index", slug: "", parentId: null }),
      createDocument({ id: "child", parentId: "index" }),
    ];

    const service = new ContentChangeService(new MemoryRepository(docs));
    const graph = await service.getGraph();

    expect(graph.getRoots().map((root) => root.id)).toEqual(["index"]);
    expect(graph.getChildren("index").map((child) => child.id)).toEqual([
      "child",
    ]);
  });
});
