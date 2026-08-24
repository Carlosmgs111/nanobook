import type { Document } from "../../document/model/types";
import { buildDocumentGraph } from "./graph";
import type {
  Crumb,
  DocumentGraph,
  NavigationNode,
  NavigationTree,
} from "../model/types";

export type { Crumb, DocumentGraph, NavigationNode, NavigationTree };

const treeCache = new WeakMap<Document[], NavigationTree>();

export function buildNavigationTree(documents: Document[]): NavigationTree {
  const cached = treeCache.get(documents);
  if (cached) return cached;

  const graph = buildDocumentGraph(documents);

  const tree: NavigationTree = {
    roots: graph.getRoots(),
    nodeMap: new Map(graph.getAllNodes().map((node) => [node.id, node])),
  };

  treeCache.set(documents, tree);
  return tree;
}

function getFolderPath(entryId: string): string {
  return entryId === "index" ? "" : entryId;
}

function getParentEntry(
  nodeMap: Map<string, NavigationNode>,
  entryId: string,
): ParentEntry | null {
  const node = nodeMap.get(entryId);
  if (!node || node.parentId === null) return null;
  const parent = nodeMap.get(node.parentId);
  if (!parent) return null;
  return { id: parent.id, data: { title: parent.title } };
}

function getImmediateChildren(
  nodeMap: Map<string, NavigationNode>,
  folderPath: string,
  excludeId?: string,
): NavigationNode[] {
  const folder = folderPath === "" ? nodeMap.get("index") : nodeMap.get(folderPath);
  if (!folder) return [];

  return folder.children.filter((child) => child.id !== excludeId);
}

function getBreadcrumbs(
  nodeMap: Map<string, NavigationNode>,
  entryId: string,
  homeTitle: string = "Inicio",
): Crumb[] {
  const crumbs: Crumb[] = [
    { id: "index", title: homeTitle, href: "/", current: false },
  ];

  if (entryId === "index") {
    crumbs[0].current = true;
    return crumbs;
  }

  const segments = entryId.split("/");
  let path = "";

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    path = path ? `${path}/${segment}` : segment;

    const node = nodeMap.get(path);
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

function getSidebarEntries(
  nodeMap: Map<string, NavigationNode>,
  entryId: string,
): NavigationNode[] {
  const node = nodeMap.get(entryId);
  if (!node || node.parentId === null) return [];

  const parent = nodeMap.get(node.parentId);
  if (!parent) return [];

  return parent.children.map((child) => ({
    ...child,
    current: child.id === entryId,
  }));
}

export {
  getBreadcrumbs,
  getFolderPath,
  getImmediateChildren,
  getParentEntry,
  getSidebarEntries,
};
