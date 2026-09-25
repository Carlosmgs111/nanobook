import type { DocumentPath } from "../../document/domain/DocumentPath";
import type { DocumentMetadata } from "../../document/domain/types";

export interface NavigationNode {
  /** Stable document identity used by graph edges and invalidation. */
  id: string;
  /** Mutable public path used to build links. */
  path: string;
  slug: string;
  title: string;
  description: string;
  isIndex: boolean;
  parentId: string | undefined;
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

export interface DocumentsGraph {
  /** Raíces del árbol de navegación. */
  getRoots(): NavigationNode[];
  /** Nodo por ID, si existe. */
  getNode(id: string): NavigationNode | undefined;
  /** Nodo por ruta pública. */
  getNodeByPath(path: string): NavigationNode | undefined;
  /** Padre inmediato de un nodo. */
  getParent(id: string): NavigationNode | undefined;
  /** Hijos directos de un nodo. */
  getChildren(id: string): NavigationNode[];
  /** Hermanos de un nodo (mismo padre), incluyendo el propio nodo. */
  getSiblings(id: string): NavigationNode[];
  /** Ancestros de un nodo, del más cercano al más lejano. */
  getAncestors(id: string): NavigationNode[];
  /** Todos los nodos del grafo. */
  getAllNodes(): NavigationNode[];
  /** Aristas de dependencia que salen de un documento. */
  getDependencies(id: string): DependencyEdge[];
  /** Aristas de dependencia que entran a un documento. */
  getIncomingEdges(id: string): DependencyEdge[];
  /** IDs de documentos que dependen de un documento dado. */
  getDependents(id: string): string[];
}

export type DependencyKind =
  | "parent-child"
  | "sibling-order"
  | "proxy-target"
  | "internal-link";

export interface DependencyEdge {
  sourceId: string;
  targetId: string;
  kind: DependencyKind;
}

export interface ParentEntry {
  id: string;
  data: {
    title: string;
  };
}

export interface NavigationService {
  /** Breadcrumbs desde la raíz hasta el documento indicado. */
  getBreadcrumbs(documentPath: DocumentPath, homeTitle?: string): Crumb[];
  /** Entradas del sidebar contextual (hermanos del documento). */
  getSidebarEntries(documentPath: DocumentPath): NavigationNode[];
  /** Padre inmediato formateado para el layout. */
  getParentEntry(documentPath: DocumentPath): ParentEntry | null;
  /** Hijos inmediatos de un documento índice. */
  getImmediateChildren(
    documentPath: DocumentPath,
    excludePath?: DocumentPath
  ): NavigationNode[];
  getInvalidatedIds(changes: DocumentChange[]): InvalidationResult;
}

export interface NavigationServiceFactory {
  /** Construye o recupera del cache un servicio de navegación para los documentos dados. */
  create(): Promise<NavigationService>;
}

export type ChangeKind = "added" | "modified" | "removed" | "renamed";
export type ChangeScope = "content" | "metadata" | "all";

export interface DocumentChange {
  id: string;
  kind: ChangeKind;
  /** Solo relevante para `modified`. `content` no propaga invalidación. */
  scope?: ChangeScope;
  /** ID anterior, solo para `renamed`. */
  previousId?: string;
}

export interface InvalidationResult {
  invalidatedIds: string[];
  removedIds: string[];
  addedIds: string[];
}
