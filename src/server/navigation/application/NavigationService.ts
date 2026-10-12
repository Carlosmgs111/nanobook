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

function toHref(path: string): string {
  return path === "index" ? "/" : `/${path}/`;
}

export class NavigationService implements NavigationServicePort {
  constructor(private documentsGraph: DocumentsGraph) {}

  replaceGraph(documentsGraph: DocumentsGraph): void {
    this.documentsGraph = documentsGraph;
  }

  private resolveGraphId(value: string): string {
    return this.documentsGraph.getNode(value)?.id ?? value;
  }

  getDocumentIdByPath(path: string): string | undefined {
    return this.documentsGraph.getNodeByPath(path)?.id;
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

  getBreadcrumbs(documentPath: string, homeTitle: string = "Inicio"): Crumb[] {
    const currentPath = documentPath;
    const nanobookRoot = this.getNanobookRoot(currentPath);
    if (nanobookRoot) {
      const crumbs: Crumb[] = [
        {
          id: nanobookRoot.path,
          title: homeTitle,
          href: toHref(nanobookRoot.path),
          current: nanobookRoot.path === currentPath,
        },
      ];
      if (nanobookRoot.path === currentPath) return crumbs;

      const relativePath = currentPath.slice(nanobookRoot.path.length + 1);
      let path = nanobookRoot.path;
      for (const segment of relativePath.split("/")) {
        path = `${path}/${segment}`;
        const node = this.documentsGraph.getNodeByPath(path);
        crumbs.push({
          id: path,
          title: node?.title ?? segment,
          href: toHref(path),
          current: path === currentPath,
        });
      }
      return crumbs;
    }

    const crumbs: Crumb[] = [
      { id: "index", title: homeTitle, href: "/", current: false },
    ];

    if (currentPath === "index") {
      crumbs[0].current = true;
      return crumbs;
    }

    const segments = currentPath.split("/");
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

  getSidebarEntries(documentPath: string): NavigationNode[] {
    const currentPath = documentPath;
    const node = this.documentsGraph.getNodeByPath(currentPath);
    const nanobookRoot = this.getNanobookRoot(currentPath);
    if (node && nanobookRoot?.id === node.id) {
      return node.children.map((child) => ({
        ...child,
        current: child.path === currentPath,
      }));
    }
    if (!node || node.parentId === null) return [];

    const parent = this.documentsGraph.getNode(node.parentId as string);
    if (!parent) return [];

    return parent.children.map((child) => ({
      ...child,
      current: child.path === documentPath,
    }));
  }

  getParentEntry(documentPath: string): ParentEntry | null {
    const currentPath = documentPath;
    const node = this.documentsGraph.getNodeByPath(currentPath);
    if (node && this.getNanobookRoot(currentPath)?.id === node.id) return null;
    const parent = node ? this.documentsGraph.getParent(node.id) : undefined;
    if (!parent) return null;

    return {
      id: parent.id,
      path: parent.path,
      data: { title: parent.title },
    };
  }

  getImmediateChildren(
    documentPath: string,
    excludePath?: string
  ): NavigationNode[] {
    const folderPath = getFolderPath(documentPath);
    const folder =
      folderPath === ""
        ? this.documentsGraph.getNodeByPath("index")
        : this.documentsGraph.getNodeByPath(folderPath);

    if (!folder) return [];

    return folder.children.filter((child) => child.path !== excludePath);
  }

  private getNanobookRoot(path: string): NavigationNode | undefined {
    let current = this.documentsGraph.getNodeByPath(path);
    while (current) {
      if (current.isIndex && current.metadata.nanobook === true) return current;
      current = this.documentsGraph.getParent(current.id);
    }
    return undefined;
  }
}
