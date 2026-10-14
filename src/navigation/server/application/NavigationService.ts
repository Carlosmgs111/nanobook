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

export class NavigationService implements NavigationServicePort {
  constructor(
    private documentsGraph: DocumentsGraph,
    private readonly options: { rootPath?: string; basePath?: string } = {},
  ) {}

  getHref(documentPath: string): string {
    const path = this.normalizePath(documentPath);
    const basePath = this.options.basePath?.replace(/\/+$/, "") ?? "";
    if (path === "index") return basePath || "/";
    return `${basePath}/${path}/`;
  }

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
    const currentPath = this.normalizePath(documentPath);
    if (this.options.rootPath) {
      return this.getContextBreadcrumbs(currentPath, homeTitle, this.options.rootPath);
    }

    const crumbs: Crumb[] = [
      { id: "index", title: homeTitle, href: this.getHref("index"), current: false },
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
        href: this.getHref(path),
        current: isCurrent,
      });
    }

    return crumbs;
  }

  getSidebarEntries(documentPath: string): NavigationNode[] {
    const currentPath = this.normalizePath(documentPath);
    const node = this.documentsGraph.getNodeByPath(currentPath);
    if (this.options.rootPath) {
      const root = this.documentsGraph.getNodeByPath(this.options.rootPath);
      if (node && root?.id === node.id) {
        return root.children.map((child) => ({
          ...child,
          current: child.path === currentPath,
        }));
      }
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
    const currentPath = this.normalizePath(documentPath);
    const node = this.documentsGraph.getNodeByPath(currentPath);
    if (this.options.rootPath && node?.path === this.options.rootPath) return null;
    const parent = node ? this.documentsGraph.getParent(node.id) : undefined;
    if (!parent) return null;

    return {
      id: parent.id,
      path: parent.path,
      href: this.getHref(parent.path),
      data: { title: parent.title },
    };
  }

  getImmediateChildren(
    documentPath: string,
    excludePath?: string
  ): NavigationNode[] {
    const folderPath = getFolderPath(this.normalizePath(documentPath));
    const folder =
      folderPath === ""
        ? this.documentsGraph.getNodeByPath("index")
        : this.documentsGraph.getNodeByPath(folderPath);

    if (!folder) return [];

    return folder.children.filter((child) => child.path !== excludePath);
  }

  private normalizePath(value: string | { getPublicValue(): string }): string {
    return typeof value === "string" ? value : value.getPublicValue();
  }

  private getContextBreadcrumbs(
    currentPath: string,
    homeTitle: string,
    rootPath: string,
  ): Crumb[] {
    const root = this.documentsGraph.getNodeByPath(rootPath);
    const rootTitle = root?.title ?? homeTitle;
    const crumbs: Crumb[] = [
      {
        id: rootPath,
        title: rootTitle,
        href: this.getHref(rootPath),
        current: rootPath === currentPath,
      },
    ];
    const isGlobalRoot = rootPath === "index";
    if (
      rootPath === currentPath ||
      (!isGlobalRoot && !currentPath.startsWith(`${rootPath}/`))
    ) {
      return crumbs;
    }

    const relativePath = isGlobalRoot
      ? currentPath
      : currentPath.slice(rootPath.length + 1);
    let path = isGlobalRoot ? "" : rootPath;
    for (const segment of relativePath.split("/")) {
      if (!segment) continue;
      path = path ? `${path}/${segment}` : segment;
      const node = this.documentsGraph.getNodeByPath(path);
      crumbs.push({
        id: path,
        title: node?.title ?? segment,
        href: this.getHref(path),
        current: path === currentPath,
      });
    }
    return crumbs;
  }
}
