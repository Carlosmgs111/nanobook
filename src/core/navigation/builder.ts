import type { Document, DocumentMetadata } from "../content/types";

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

/**
 * Cache a nivel de módulo para el árbol de navegación.
 * Como los Document[] suelen venir del mismo repository.list(),
 * un WeakMap evita reconstruir el árbol para cada página generada.
 */
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

/**
 * Construye el árbol de navegación completo a partir de todos los documentos.
 *
 * Devuelve las raíces del árbol y un mapa id → nodo para consultas directas.
 * A partir de esta estructura se derivan breadcrumb, sidebar e índices.
 *
 * El resultado se cachea por el array de documentos para no reconstruirlo
 * en cada página durante el build.
 */
export function buildNavigationTree(documents: Document[]): NavigationTree {
  const cached = treeCache.get(documents);

  if (cached) return cached;

  const nodeMap = new Map<string, NavigationNode>();

  for (const document of documents) {
    if (document.metadata.draft) continue;
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

function getParentPath(entryId: string): string | null {
  if (entryId === "index") return null;
  const lastSlash = entryId.lastIndexOf("/");
  return lastSlash === -1 ? "" : entryId.slice(0, lastSlash);
}

/**
 * Devuelve el nodo padre de un documento dado.
 */
export function getParentEntry(
  nodeMap: Map<string, NavigationNode>,
  entryId: string,
): NavigationNode | null {
  const node = nodeMap.get(entryId);
  if (!node || node.parentId === null) return null;
  return nodeMap.get(node.parentId) ?? null;
}

/**
 * Devuelve los nodos hijos directos de una carpeta.
 */
export function getImmediateChildren(
  nodeMap: Map<string, NavigationNode>,
  folderPath: string,
  excludeId?: string,
): NavigationNode[] {
  const folder = folderPath === "" ? nodeMap.get("index") : nodeMap.get(folderPath);
  if (!folder) return [];

  return folder.children.filter((child) => child.id !== excludeId);
}

/**
 * Construye el breadcrumb de un documento usando el árbol de navegación.
 */
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

/**
 * Devuelve las entradas del sidebar para un documento dado.
 * Son los hermanos del documento dentro de su carpeta padre.
 */
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
