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

import { DocumentPath } from "../../document/domain/DocumentPath";

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

  private resolveGraphId(value: string): string {
    return this.documentsGraph.getNode(value)?.id
      ?? this.documentsGraph.getNodeByPath(value)?.id
      ?? value;
  }

  getInvalidatedIds(changes: DocumentChange[]): InvalidationResult {
    const addedIds = new Set<string>();
    const removedIds = new Set<string>();
    const invalidatedIds = new Set<string>();

    // Cada nodo en la cola lleva asociado los tipos de arista por los que puede
    // propagar su invalidación.
    const queue: { id: string; allowed: DependencyKind[] | "all" }[] = [];

    for (const change of changes) {
      const graphId = this.resolveGraphId(change.id);
      const allowed = getAllowedKinds(change);

      switch (change.kind) {
        case "added":
          addedIds.add(graphId);
          invalidatedIds.add(graphId);
          queue.push({ id: graphId, allowed });
          break;

        case "removed":
          removedIds.add(graphId);
          invalidatedIds.add(graphId);
          queue.push({ id: graphId, allowed });
          break;

        case "modified":
          invalidatedIds.add(graphId);
          queue.push({ id: graphId, allowed });
          break;

        case "renamed":
          invalidatedIds.add(graphId);
          queue.push({ id: graphId, allowed });
          if (change.previousId) {
            const previousGraphId = this.resolveGraphId(change.previousId);
            removedIds.add(previousGraphId);
            invalidatedIds.add(previousGraphId);
            queue.push({ id: previousGraphId, allowed });
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

  getBreadcrumbs(documentPath: DocumentPath, homeTitle: string = "Inicio"): Crumb[] {
    const crumbs: Crumb[] = [
      { id: "index", title: homeTitle, href: "/", current: false },
    ];

    if (documentPath.getValue() === "index") {
      crumbs[0].current = true;
      return crumbs;
    }

    const segments = documentPath.getValue().split("/");
    let path = "";

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      path = path ? `${path}/${segment}` : segment;

      const node = this.documentsGraph.getNodeByPath(path);
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

  getSidebarEntries(documentPath: DocumentPath): NavigationNode[] {
    const node = this.documentsGraph.getNodeByPath(documentPath.getValue());
    if (!node || node.parentId === null) return [];

    const parent = this.documentsGraph.getNode(node.parentId as string);
    if (!parent) return [];

    return parent.children.map((child) => ({
      ...child,
      current: child.path === documentPath.getValue(),
    }));
  }

  getParentEntry(documentPath: DocumentPath): ParentEntry | null {
    const node = this.documentsGraph.getNodeByPath(documentPath.getValue());
    const parent = node ? this.documentsGraph.getParent(node.id) : undefined;
    if (!parent) return null;

    return {
      id: parent.path,
      data: { title: parent.title },
    };
  }

  getImmediateChildren(
    documentPath: DocumentPath,
    excludePath?: DocumentPath
  ): NavigationNode[] {
    const folderPath = getFolderPath(documentPath.getValue());
    const folder =
      folderPath === ""
        ? this.documentsGraph.getNodeByPath("index")
        : this.documentsGraph.getNodeByPath(folderPath);

    if (!folder) return [];

    return folder.children.filter((child) => child.path !== excludePath?.getValue());
  }
}
