import type { Document } from "../../document/model/types";
import { buildDocumentGraph } from "../graph/graph";
import type {
  Crumb,
  DocumentGraph,
  NavigationNode,
  NavigationService,
  ParentEntry,
} from "../model/types";

const serviceCache = new WeakMap<Document[], NavigationService>();

function getFolderPath(entryId: string): string {
  return entryId === "index" ? "" : entryId;
}

class NavigationServiceImpl implements NavigationService {
  constructor(private graph: DocumentGraph) {}

  getBreadcrumbs(documentId: string, homeTitle: string = "Inicio"): Crumb[] {
    const crumbs: Crumb[] = [
      { id: "index", title: homeTitle, href: "/", current: false },
    ];

    if (documentId === "index") {
      crumbs[0].current = true;
      return crumbs;
    }

    const segments = documentId.split("/");
    let path = "";

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      path = path ? `${path}/${segment}` : segment;

      const node = this.graph.getNode(path);
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
    const node = this.graph.getNode(documentId);
    if (!node || node.parentId === null) return [];

    const parent = this.graph.getNode(node.parentId);
    if (!parent) return [];

    return parent.children.map((child) => ({
      ...child,
      current: child.id === documentId,
    }));
  }

  getParentEntry(documentId: string): ParentEntry | null {
    const parent = this.graph.getParent(documentId);
    if (!parent) return null;

    return {
      id: parent.id,
      data: { title: parent.title },
    };
  }

  getImmediateChildren(
    documentId: string,
    excludeId?: string,
  ): NavigationNode[] {
    const folderPath = getFolderPath(documentId);
    const folder = folderPath === ""
      ? this.graph.getNode("index")
      : this.graph.getNode(folderPath);

    if (!folder) return [];

    return folder.children.filter((child) => child.id !== excludeId);
  }
}

export function createNavigationService(documents: Document[]): NavigationService {
  const cached = serviceCache.get(documents);
  if (cached) return cached;

  const graph = buildDocumentGraph(documents);
  const service = new NavigationServiceImpl(graph);
  serviceCache.set(documents, service);
  return service;
}
