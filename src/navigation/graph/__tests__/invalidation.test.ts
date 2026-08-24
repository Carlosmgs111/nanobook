import { describe, it, expect } from "vitest";
import { buildDocumentGraph } from "../graph";
import { computeInvalidatedIds, shouldRebuildNavigationTree } from "../invalidation";
import { createDocument } from "../../model/__tests__/factory";

describe("computeInvalidatedIds", () => {
  it("invalida solo el documento modificado cuando el scope es content", () => {
    const documents = [
      createDocument({ id: "index", slug: "", parentId: null }),
      createDocument({ id: "a", parentId: "index" }),
    ];
    const graph = buildDocumentGraph(documents);

    const result = computeInvalidatedIds(graph, [
      { id: "a", kind: "modified", scope: "content" },
    ]);

    expect(result.invalidatedIds).toEqual(["a"]);
  });

  it("propaga a padres cuando cambia metadata", () => {
    const documents = [
      createDocument({ id: "index", slug: "", parentId: null }),
      createDocument({ id: "a", parentId: "index" }),
    ];
    const graph = buildDocumentGraph(documents);

    const result = computeInvalidatedIds(graph, [
      { id: "a", kind: "modified", scope: "metadata" },
    ]);

    expect(result.invalidatedIds).toContain("a");
    expect(result.invalidatedIds).toContain("index");
  });

  it("propaga a hermanos cuando cambia metadata", () => {
    const documents = [
      createDocument({ id: "index", slug: "", parentId: null }),
      createDocument({ id: "a", parentId: "index" }),
      createDocument({ id: "b", parentId: "index" }),
    ];
    const graph = buildDocumentGraph(documents);

    const result = computeInvalidatedIds(graph, [
      { id: "a", kind: "modified", scope: "metadata" },
    ]);

    expect(result.invalidatedIds).toContain("a");
    expect(result.invalidatedIds).toContain("b");
  });

  it("propaga por proxy-target cuando cambia contenido", () => {
    const documents = [
      createDocument({ id: "index", slug: "", parentId: null }),
      createDocument({ id: "target", parentId: "index" }),
      createDocument({
        id: "proxy",
        parentId: "index",
        proxyTargetId: "target",
      }),
    ];
    const graph = buildDocumentGraph(documents);

    const result = computeInvalidatedIds(graph, [
      { id: "target", kind: "modified", scope: "content" },
    ]);

    expect(result.invalidatedIds).toContain("target");
    expect(result.invalidatedIds).toContain("proxy");
  });

  it("identifica documentos agregados", () => {
    const documents = [
      createDocument({ id: "index", slug: "", parentId: null }),
      createDocument({ id: "a", parentId: "index" }),
    ];
    const graph = buildDocumentGraph(documents);

    const result = computeInvalidatedIds(graph, [{ id: "a", kind: "added" }]);

    expect(result.addedIds).toContain("a");
    expect(result.invalidatedIds).toContain("a");
  });

  it("identifica documentos eliminados", () => {
    const documents = [
      createDocument({ id: "index", slug: "", parentId: null }),
      createDocument({ id: "a", parentId: "index" }),
    ];
    const graph = buildDocumentGraph(documents);

    const result = computeInvalidatedIds(graph, [
      { id: "a", kind: "removed" },
    ]);

    expect(result.removedIds).toContain("a");
    expect(result.invalidatedIds).toContain("a");
  });

  it("evita ciclos infinitos al propagar dependencias", () => {
    const documents = [
      createDocument({ id: "index", slug: "", parentId: null }),
      createDocument({ id: "a", parentId: "index" }),
      createDocument({ id: "b", parentId: "index" }),
    ];
    const graph = buildDocumentGraph(documents);

    const result = computeInvalidatedIds(graph, [
      { id: "a", kind: "modified", scope: "metadata" },
      { id: "b", kind: "modified", scope: "metadata" },
    ]);

    expect(result.invalidatedIds).toContain("a");
    expect(result.invalidatedIds).toContain("b");
    expect(result.invalidatedIds).toContain("index");
    expect(new Set(result.invalidatedIds).size).toBe(
      result.invalidatedIds.length,
    );
  });
});

describe("shouldRebuildNavigationTree", () => {
  it("devuelve false cuando no hay cambios", () => {
    expect(shouldRebuildNavigationTree([])).toBe(false);
  });

  it("devuelve false cuando todos los cambios son de contenido", () => {
    const changes = [
      { id: "a", kind: "modified" as const, scope: "content" as const },
      { id: "b", kind: "modified" as const, scope: "content" as const },
    ];
    expect(shouldRebuildNavigationTree(changes)).toBe(false);
  });

  it("devuelve true cuando un cambio afecta metadata", () => {
    const changes = [
      { id: "a", kind: "modified" as const, scope: "content" as const },
      { id: "b", kind: "modified" as const, scope: "metadata" as const },
    ];
    expect(shouldRebuildNavigationTree(changes)).toBe(true);
  });

  it("devuelve true para cambios estructurales", () => {
    expect(shouldRebuildNavigationTree([{ id: "a", kind: "added" }])).toBe(true);
    expect(
      shouldRebuildNavigationTree([{ id: "a", kind: "removed" }]),
    ).toBe(true);
    expect(
      shouldRebuildNavigationTree([
        { id: "a", kind: "renamed", previousId: "old" },
      ]),
    ).toBe(true);
  });
});
