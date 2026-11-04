import type { NavigationNode, NavigationService } from "../domain/types";

function redact(node: NavigationNode): NavigationNode {
  const children = node.children.map(redact);
  if (node.metadata.secured !== true) {
    return children.every((child, index) => child === node.children[index]) ? node : { ...node, children };
  }
  return {
    ...node,
    description: "",
    children,
    metadata: {
      ...node.metadata,
      description: "",
      tags: [],
      cover: undefined,
    },
  };
}

/**
 * Viewer-scoped view of the shared navigation graph: protected documents keep
 * their title, path and lock flag, and nothing that could describe their
 * content. The shared graph cache is never modified.
 */
export function restrictSecuredNavigation(service: NavigationService): NavigationService {
  return {
    getHref: (documentPath) => service.getHref(documentPath),
    getDocumentIdByPath: (path) => service.getDocumentIdByPath(path),
    getBreadcrumbs: (documentPath, homeTitle) => service.getBreadcrumbs(documentPath, homeTitle),
    getSidebarEntries: (documentPath) => service.getSidebarEntries(documentPath).map(redact),
    getParentEntry: (documentPath) => service.getParentEntry(documentPath),
    getImmediateChildren: (documentPath, excludePath) =>
      service.getImmediateChildren(documentPath, excludePath).map(redact),
    getInvalidatedIds: (changes) => service.getInvalidatedIds(changes),
  };
}
