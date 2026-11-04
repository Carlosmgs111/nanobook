import { describe, expect, it } from "vitest";

import type { NavigationNode, NavigationService } from "../domain/types";
import { restrictSecuredNavigation } from "./restrictSecuredNavigation";

function node(overrides: Partial<NavigationNode> & { secured?: boolean } = {}): NavigationNode {
  const { secured, ...rest } = overrides;
  return {
    id: "doc-1",
    path: "guia",
    slug: "guia",
    title: "Guía",
    description: "Texto que revela contenido",
    isIndex: false,
    parentId: undefined,
    position: 0,
    metadata: {
      title: "Guía",
      description: "Texto que revela contenido",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      tags: ["privado"],
      cover: "https://cdn.test/portada.png",
      secured,
    },
    children: [],
    ...rest,
  };
}

function service(nodes: NavigationNode[]): NavigationService {
  return {
    getHref: (path) => `/n/libro/${path}`,
    getDocumentIdByPath: () => "doc-1",
    getBreadcrumbs: () => [],
    getSidebarEntries: () => nodes,
    getParentEntry: () => null,
    getImmediateChildren: () => nodes,
    getInvalidatedIds: () => ({ invalidatedIds: [], removedIds: [], addedIds: [] }),
  };
}

describe("restrictSecuredNavigation", () => {
  it("keeps title, path and the flag of protected nodes but hides descriptive data", () => {
    const restricted = restrictSecuredNavigation(service([node({ secured: true })]));

    const [entry] = restricted.getImmediateChildren("index");

    expect(entry.title).toBe("Guía");
    expect(entry.path).toBe("guia");
    expect(entry.metadata.secured).toBe(true);
    expect(entry.description).toBe("");
    expect(entry.metadata.description).toBe("");
    expect(entry.metadata.tags).toEqual([]);
    expect(entry.metadata.cover).toBeUndefined();
  });

  it("does not touch unprotected nodes", () => {
    const original = node();
    const restricted = restrictSecuredNavigation(service([original]));

    expect(restricted.getSidebarEntries("guia")[0]).toBe(original);
  });

  it("redacts protected descendants", () => {
    const child = node({ id: "doc-2", path: "guia/hijo", secured: true });
    const parent = node({ id: "doc-1", children: [child] });

    const [entry] = restrictSecuredNavigation(service([parent])).getImmediateChildren("index");

    expect(entry.children[0].description).toBe("");
    expect(entry.children[0].metadata.tags).toEqual([]);
  });

  it("delegates everything else to the wrapped service", () => {
    const restricted = restrictSecuredNavigation(service([]));

    expect(restricted.getHref("guia")).toBe("/n/libro/guia");
    expect(restricted.getDocumentIdByPath("guia")).toBe("doc-1");
  });
});
