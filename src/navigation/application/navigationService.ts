import type {
  Crumb,
  DocumentChange,
  DocumentsGraph,
  InvalidationResult,
  NavigationNode,
  NavigationService as NavigationServicePort,
  ParentEntry,
  DependencyKind,
} from "../domain/types";

import { DocumentId } from "../../document/domain/DocumentId";

function getFolderPath(entryId: string): string {
  return entryId === "index" ? "" : entryId;
}

function getAllowedKinds(change: DocumentChange): DependencyKind[] | "all" {
  if (change.kind !== "modified") return "all";

  switch (change.scope) {
    case "content":
      return ["proxy-target"];
    case "metadata":
      return ["parent-child", "sibling-order", "proxy-target"];
    case "all":
    default:
      return "all";
  }
}

function matchesKind(
  kind: DependencyKind,
  allowed: DependencyKind[] | "all"
): boolean {
  return allowed === "all" || allowed.includes(kind);
}

export class NavigationService implements NavigationServicePort {
  constructor(private documentsGraph: DocumentsGraph) {}

  getInvalidatedIds(changes: DocumentChange[]): InvalidationResult {
    const addedIds = new Set<string>();
    const removedIds = new Set<string>();
    const invalidatedIds = new Set<string>();

    // Cada nodo en la cola lleva asociado los tipos de arista por los que puede
    // propagar su invalidación.
    const queue: { id: string; allowed: DependencyKind[] | "all" }[] = [];

    for (const change of changes) {
      const allowed = getAllowedKinds(change);

      switch (change.kind) {
        case "added":
          addedIds.add(change.id);
          invalidatedIds.add(change.id);
          queue.push({ id: change.id, allowed });
          break;

        case "removed":
          removedIds.add(change.id);
          invalidatedIds.add(change.id);
          queue.push({ id: change.id, allowed });
          break;

        case "modified":
          invalidatedIds.add(change.id);
          queue.push({ id: change.id, allowed });
          break;

        case "renamed":
          invalidatedIds.add(change.id);
          queue.push({ id: change.id, allowed });
          if (change.previousId) {
            removedIds.add(change.previousId);
            invalidatedIds.add(change.previousId);
            queue.push({ id: change.previousId, allowed });
          }
          break;
      }
    }

    let index = 0;
    while (index < queue.length) {
      const { id: currentId, allowed } = queue[index++];

      for (const edge of this.documentsGraph.getIncomingEdges(currentId)) {
        if (!matchesKind(edge.kind, allowed)) continue;
        if (invalidatedIds.has(edge.sourceId)) continue;

        invalidatedIds.add(edge.sourceId);
        // Los dependientes heredan las mismas reglas de propagación.
        queue.push({ id: edge.sourceId, allowed });
      }
    }

    return {
      invalidatedIds: Array.from(invalidatedIds),
      removedIds: Array.from(removedIds),
      addedIds: Array.from(addedIds),
    };
  }

  getBreadcrumbs(documentId: DocumentId, homeTitle: string = "Inicio"): Crumb[] {
    const crumbs: Crumb[] = [
      { id: "index", title: homeTitle, href: "/", current: false },
    ];

    if (documentId.getValue() === "index") {
      crumbs[0].current = true;
      return crumbs;
    }

    const segments = documentId.getValue().split("/");
    let path = "";

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      path = path ? `${path}/${segment}` : segment;

      const node = this.documentsGraph.getNode(path);
      const title = node?.title ?? segment;
      const isCurrent = i === segments.length - 1;

      crumbs.push({
        id: path,
        title,
        href: `/${path}/`,
        current: isCurrent,
      });
    }

    return crumbs;
  }

  getSidebarEntries(documentId: DocumentId): NavigationNode[] {
    const node = this.documentsGraph.getNode(documentId.getValue());
    if (!node || node.parentId === null) return [];

    const parent = this.documentsGraph.getNode(node.parentId as string);
    if (!parent) return [];

    return parent.children.map((child) => ({
      ...child,
      current: child.id === documentId.getValue(),
    }));
  }

  getParentEntry(documentId: DocumentId): ParentEntry | null {
    const parent = this.documentsGraph.getParent(documentId.getValue());
    if (!parent) return null;

    return {
      id: parent.id,
      data: { title: parent.title },
    };
  }

  getImmediateChildren(
    documentId: DocumentId,
    excludeId?: DocumentId  
  ): NavigationNode[] {
    const folderPath = getFolderPath(documentId.getValue());
    const folder =
      folderPath === ""
        ? this.documentsGraph.getNode("index")
        : this.documentsGraph.getNode(folderPath);

    if (!folder) return [];

    return folder.children.filter((child) => child.id !== excludeId?.getValue());
  }
}
