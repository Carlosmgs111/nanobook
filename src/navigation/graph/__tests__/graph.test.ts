import { describe, it, expect } from "vitest";
import { buildDocumentGraph } from "../graph";
import { createDocument } from "../../model/__tests__/factory";

describe("buildDocumentGraph", () => {
  it("construye raíces a partir de documentos sin padre", () => {
    const documents = [
      createDocument({ id: "index", slug: "", parentId: null }),
    ];
    const graph = buildDocumentGraph(documents);

    expect(graph.getRoots().map((root) => root.id)).toEqual(["index"]);
  });

  it("asigna hijos a sus padres", () => {
    const documents = [
      createDocument({ id: "index", slug: "", parentId: null }),
      createDocument({ id: "child", parentId: "index" }),
    ];
    const graph = buildDocumentGraph(documents);

    expect(graph.getChildren("index").map((child) => child.id)).toEqual([
      "child",
    ]);
    expect(graph.getParent("child")?.id).toBe("index");
  });

  it("devuelve hermanos incluyendo el propio nodo", () => {
    const documents = [
      createDocument({ id: "index", slug: "", parentId: null }),
      createDocument({ id: "a", parentId: "index" }),
      createDocument({ id: "b", parentId: "index" }),
    ];
    const graph = buildDocumentGraph(documents);

    const siblings = graph.getSiblings("a").map((sibling) => sibling.id);
    expect(siblings).toContain("a");
    expect(siblings).toContain("b");
  });

  it("devuelve ancestros ordenados del más cercano al más lejano", () => {
    const documents = [
      createDocument({ id: "index", slug: "", parentId: null }),
      createDocument({ id: "parent", parentId: "index" }),
      createDocument({ id: "child", parentId: "parent" }),
    ];
    const graph = buildDocumentGraph(documents);

    expect(graph.getAncestors("child").map((node) => node.id)).toEqual([
      "parent",
      "index",
    ]);
  });

  it("devuelve todos los nodos", () => {
    const documents = [
      createDocument({ id: "index", slug: "", parentId: null }),
      createDocument({ id: "a", parentId: "index" }),
      createDocument({ id: "b", parentId: "index" }),
    ];
    const graph = buildDocumentGraph(documents);

    expect(graph.getAllNodes().length).toBe(3);
  });

  it("crea aristas de dependencia parent-child", () => {
    const documents = [
      createDocument({ id: "index", slug: "", parentId: null }),
      createDocument({ id: "child", parentId: "index" }),
    ];
    const graph = buildDocumentGraph(documents);

    const childDeps = graph.getDependencies("child");
    expect(childDeps.some((edge) => edge.kind === "parent-child")).toBe(true);
    expect(graph.getDependents("index")).toContain("child");
  });

  it("crea aristas de proxy-target", () => {
    const documents = [
      createDocument({ id: "index", slug: "", parentId: null }),
      createDocument({ id: "proxy", parentId: "index", proxyTargetId: "target" }),
      createDocument({ id: "target", parentId: "index" }),
    ];
    const graph = buildDocumentGraph(documents);

    const proxyDeps = graph.getDependencies("proxy");
    expect(
      proxyDeps.some(
        (edge) => edge.targetId === "target" && edge.kind === "proxy-target",
      ),
    ).toBe(true);
  });

  it("crea aristas de internal-link", () => {
    const documents = [
      createDocument({ id: "index", slug: "", parentId: null }),
      createDocument({
        id: "a",
        parentId: "index",
        content: "[link](./b)",
      }),
      createDocument({ id: "b", parentId: "index" }),
    ];
    const graph = buildDocumentGraph(documents);

    const deps = graph.getDependencies("a");
    expect(
      deps.some(
        (edge) => edge.targetId === "b" && edge.kind === "internal-link",
      ),
    ).toBe(true);
  });
});
