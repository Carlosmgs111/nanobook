import type { Document, DocumentMetadata } from "../../document/core/types";

export interface NavigationNode {
  id: string;
  slug: string;
  title: string;
  description: string;
  isIndex: boolean;
  parentId: string | null;
  position: number;
  metadata: DocumentMetadata;
  children: NavigationNode[];
  current?: boolean;
}

export interface Crumb {
  id: string;
  title: string;
  href: string;
  current: boolean;
}

export interface NavigationTree {
  roots: NavigationNode[];
  nodeMap: Map<string, NavigationNode>;
}

const treeCache = new WeakMap<Document[], NavigationTree>();

function toNavigationNode(document: Document): NavigationNode {
  return {
    id: document.id,
    slug: document.slug,
    title: document.title,
    description: document.description,
    isIndex: document.metadata.index,
    parentId: document.parentId,
    position: document.position,
    metadata: document.metadata,
    children: [],
  };
}

function sortNodes(nodes: NavigationNode[]): NavigationNode[] {
  return [...nodes].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return a.title.localeCompare(b.title);
  });
}

export function buildNavigationTree(documents: Document[]): NavigationTree {
  const cached = treeCache.get(documents);

  if (cached) return cached;

  const nodeMap = new Map<string, NavigationNode>();

  for (const document of documents) {
    // if (document.metadata.draft) continue;
    nodeMap.set(document.id, toNavigationNode(document));
  }

  const roots: NavigationNode[] = [];

  for (const node of nodeMap.values()) {
    if (node.parentId === null) {
      roots.push(node);
      continue;
    }

    const parent = nodeMap.get(node.parentId);
    if (parent) {
      parent.children.push(node);
    } else {
      // Si no hay padre visible, lo tratamos como raíz.
      roots.push(node);
    }
  }

  for (const node of nodeMap.values()) {
    node.children = sortNodes(node.children);
  }

  const tree: NavigationTree = {
    roots: sortNodes(roots),
    nodeMap,
  };

  treeCache.set(documents, tree);
  return tree;
}

function getFolderPath(entryId: string): string {
  return entryId === "index" ? "" : entryId;
}

export function getParentEntry(
  nodeMap: Map<string, NavigationNode>,
  entryId: string,
): NavigationNode | null {
  const node = nodeMap.get(entryId);
  if (!node || node.parentId === null) return null;
  return nodeMap.get(node.parentId) ?? null;
}

export function getImmediateChildren(
  nodeMap: Map<string, NavigationNode>,
  folderPath: string,
  excludeId?: string,
): NavigationNode[] {
  const folder = folderPath === "" ? nodeMap.get("index") : nodeMap.get(folderPath);
  if (!folder) return [];

  return folder.children.filter((child) => child.id !== excludeId);
}

export function getBreadcrumbs(
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

export function getSidebarEntries(
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

export { getFolderPath };
