import type {
  Crumb,
  DocumentGraphService,
  NavigationNode,
  NavigationService as NavigationServicePort,
  ParentEntry,
} from "../domain/types";

function getFolderPath(entryId: string): string {
  return entryId === "index" ? "" : entryId;
}

export class NavigationService implements NavigationServicePort {
  constructor(private graphService: DocumentGraphService) {}

  getBreadcrumbs(documentId: string, homeTitle: string = "Inicio"): Crumb[] {
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

      const node = this.graphService.getNode(path);
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

  getSidebarEntries(documentId: string): NavigationNode[] {
    const node = this.graphService.getNode(documentId.getValue());
    if (!node || node.parentId === null) return [];

    const parent = this.graphService.getNode(node.parentId);
    if (!parent) return [];

    return parent.children.map((child) => ({
      ...child,
      current: child.id === documentId.getValue(),
    }));
  }

  getParentEntry(documentId: string): ParentEntry | null {
    const parent = this.graphService.getParent(documentId.getValue());
    if (!parent) return null;

    return {
      id: parent.id,
      data: { title: parent.title },
    };
  }

  getImmediateChildren(
    documentId: string,
    excludeId?: string
  ): NavigationNode[] {
    const folderPath = getFolderPath(documentId.getValue());
    const folder =
      folderPath === ""
        ? this.graphService.getNode("index")
        : this.graphService.getNode(folderPath);

    if (!folder) return [];

    return folder.children.filter((child) => child.id !== excludeId);
  }
}
