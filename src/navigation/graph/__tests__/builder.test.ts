import { describe, it, expect } from "vitest";
import {
  buildNavigationTree,
  getBreadcrumbs,
  getSidebarEntries,
  getImmediateChildren,
  getParentEntry,
} from "../builder";
import { createDocument } from "../../model/__tests__/factory";

describe("buildNavigationTree", () => {
  it("construye raíces y nodeMap", () => {
    const documents = [
      createDocument({ id: "index", slug: "", parentId: null }),
      createDocument({ id: "child", parentId: "index" }),
    ];
    const tree = buildNavigationTree(documents);

    expect(tree.roots.map((root) => root.id)).toEqual(["index"]);
    expect(tree.nodeMap.has("child")).toBe(true);
  });
});

describe("getBreadcrumbs", () => {
  it("devuelve solo inicio para el índice", () => {
    const documents = [
      createDocument({ id: "index", slug: "", parentId: null }),
    ];
    const tree = buildNavigationTree(documents);

    const crumbs = getBreadcrumbs(tree.nodeMap, "index");
    expect(crumbs).toEqual([
      { id: "index", title: "Inicio", href: "/", current: true },
    ]);
  });

  it("construye breadcrumbs para documentos anidados", () => {
    const documents = [
      createDocument({ id: "index", slug: "", parentId: null }),
      createDocument({ id: "parent", parentId: "index", title: "Parent" }),
      createDocument({ id: "parent/child", parentId: "parent", title: "Child" }),
    ];
    const tree = buildNavigationTree(documents);

    const crumbs = getBreadcrumbs(tree.nodeMap, "parent/child");
    expect(crumbs.map((crumb) => crumb.id)).toEqual([
      "index",
      "parent",
      "parent/child",
    ]);
    expect(crumbs[crumbs.length - 1].current).toBe(true);
  });
});

describe("getSidebarEntries", () => {
  it("devuelve hermanos del documento marcando el actual", () => {
    const documents = [
      createDocument({ id: "index", slug: "", parentId: null }),
      createDocument({ id: "a", parentId: "index", title: "A" }),
      createDocument({ id: "b", parentId: "index", title: "B" }),
    ];
    const tree = buildNavigationTree(documents);

    const entries = getSidebarEntries(tree.nodeMap, "a");
    expect(entries.map((entry) => entry.id)).toEqual(["a", "b"]);
    expect(entries.find((entry) => entry.id === "a")?.current).toBe(true);
  });

  it("devuelve vacío para la raíz", () => {
    const documents = [
      createDocument({ id: "index", slug: "", parentId: null }),
    ];
    const tree = buildNavigationTree(documents);

    expect(getSidebarEntries(tree.nodeMap, "index")).toEqual([]);
  });
});

describe("getImmediateChildren", () => {
  it("devuelve hijos de un documento índice", () => {
    const documents = [
      createDocument({ id: "index", slug: "", parentId: null }),
      createDocument({ id: "a", parentId: "index" }),
      createDocument({ id: "b", parentId: "index" }),
    ];
    const tree = buildNavigationTree(documents);

    const children = getImmediateChildren(tree.nodeMap, "index");
    expect(children.map((child) => child.id)).toEqual(["a", "b"]);
  });

  it("excluye el id proporcionado", () => {
    const documents = [
      createDocument({ id: "index", slug: "", parentId: null }),
      createDocument({ id: "a", parentId: "index" }),
      createDocument({ id: "b", parentId: "index" }),
    ];
    const tree = buildNavigationTree(documents);

    const children = getImmediateChildren(tree.nodeMap, "index", "a");
    expect(children.map((child) => child.id)).toEqual(["b"]);
  });
});

describe("getParentEntry", () => {
  it("devuelve el padre formateado", () => {
    const documents = [
      createDocument({ id: "index", slug: "", parentId: null }),
      createDocument({ id: "child", parentId: "index", title: "Child" }),
    ];
    const tree = buildNavigationTree(documents);

    expect(getParentEntry(tree.nodeMap, "child")).toEqual({
      id: "index",
      data: { title: "Document" },
    });
  });

  it("devuelve null para la raíz", () => {
    const documents = [
      createDocument({ id: "index", slug: "", parentId: null }),
    ];
    const tree = buildNavigationTree(documents);

    expect(getParentEntry(tree.nodeMap, "index")).toBeNull();
  });
});
