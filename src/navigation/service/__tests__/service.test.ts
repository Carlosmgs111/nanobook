import { describe, it, expect } from "vitest";
import { createNavigationService } from "../service";
import { createDocument } from "../../model/__tests__/factory";

describe("createNavigationService", () => {
  it("devuelve breadcrumbs para un documento", () => {
    const documents = [
      createDocument({ id: "index", slug: "", parentId: null }),
      createDocument({ id: "parent", parentId: "index", title: "Parent" }),
      createDocument({ id: "parent/child", parentId: "parent", title: "Child" }),
    ];
    const service = createNavigationService(documents);

    const crumbs = service.getBreadcrumbs("parent/child");
    expect(crumbs.map((crumb) => crumb.id)).toEqual([
      "index",
      "parent",
      "parent/child",
    ]);
  });

  it("devuelve entradas del sidebar", () => {
    const documents = [
      createDocument({ id: "index", slug: "", parentId: null }),
      createDocument({ id: "a", parentId: "index", title: "A" }),
      createDocument({ id: "b", parentId: "index", title: "B" }),
    ];
    const service = createNavigationService(documents);

    const entries = service.getSidebarEntries("a");
    expect(entries.map((entry) => entry.id)).toEqual(["a", "b"]);
  });

  it("devuelve el padre inmediato", () => {
    const documents = [
      createDocument({ id: "index", slug: "", parentId: null }),
      createDocument({ id: "child", parentId: "index", title: "Child" }),
    ];
    const service = createNavigationService(documents);

    expect(service.getParentEntry("child")).toEqual({
      id: "index",
      data: { title: "Document" },
    });
  });

  it("devuelve hijos inmediatos", () => {
    const documents = [
      createDocument({ id: "index", slug: "", parentId: null }),
      createDocument({ id: "a", parentId: "index" }),
      createDocument({ id: "b", parentId: "index" }),
    ];
    const service = createNavigationService(documents);

    const children = service.getImmediateChildren("index");
    expect(children.map((child) => child.id)).toEqual(["a", "b"]);
  });

  it("cachea el servicio para el mismo array de documentos", () => {
    const documents = [
      createDocument({ id: "index", slug: "", parentId: null }),
    ];
    const serviceA = createNavigationService(documents);
    const serviceB = createNavigationService(documents);

    expect(serviceA).toBe(serviceB);
  });
});
