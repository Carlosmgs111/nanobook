import { extractInternalLinkTargets } from "../../document/reference/link-extractor";
import type { Document } from "../../document/model/types";
import type {
  DependencyEdge,
  DependencyKind,
  DocumentGraph,
  NavigationNode,
} from "../model/types";

const graphCache = new WeakMap<Document[], DocumentGraph>();

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

class DocumentGraphImpl implements DocumentGraph {
  private nodeMap: Map<string, NavigationNode>;
  private rootNodes: NavigationNode[];
  private dependencies: Map<string, DependencyEdge[]>;
  private dependents: Map<string, Set<string>>;
  private incoming: Map<string, DependencyEdge[]>;

  constructor(documents: Document[]) {
    const map = new Map<string, NavigationNode>();

    for (const document of documents) {
      map.set(document.id, toNavigationNode(document));
    }

    const roots: NavigationNode[] = [];

    for (const node of map.values()) {
      if (node.parentId === null) {
        roots.push(node);
        continue;
      }

      const parent = map.get(node.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }

    for (const node of map.values()) {
      node.children = sortNodes(node.children);
    }

    this.nodeMap = map;
    this.rootNodes = sortNodes(roots);
    this.dependencies = new Map();
    this.dependents = new Map();
    this.incoming = new Map();

    for (const document of documents) {
      this.dependencies.set(document.id, []);
      this.dependents.set(document.id, new Set());
      this.incoming.set(document.id, []);
    }

    this.buildEdges(documents);
  }

  private addEdge(sourceId: string, targetId: string, kind: DependencyKind) {
    if (sourceId === targetId) return;
    if (!this.dependencies.has(sourceId) || !this.dependencies.has(targetId)) {
      return;
    }

    const edge: DependencyEdge = { sourceId, targetId, kind };
    this.dependencies.get(sourceId)!.push(edge);
    this.dependents.get(targetId)!.add(sourceId);
    this.incoming.get(targetId)!.push(edge);
  }

  private buildEdges(documents: Document[]) {
    const documentsByParent = new Map<string | null, Document[]>();

    for (const document of documents) {
      const key = document.parentId;
      const siblings = documentsByParent.get(key) ?? [];
      siblings.push(document);
      documentsByParent.set(key, siblings);
    }

    for (const document of documents) {
      // parent-child: child -> parent
      if (document.parentId && this.nodeMap.has(document.parentId)) {
        this.addEdge(document.id, document.parentId, "parent-child");
      }

      // parent-child: parent -> child
      const children = documentsByParent.get(document.id) ?? [];
      for (const child of children) {
        this.addEdge(document.id, child.id, "parent-child");
      }

      // sibling-order: cada hermano depende de los demas
      const siblings = documentsByParent.get(document.parentId) ?? [];
      for (const sibling of siblings) {
        if (sibling.id !== document.id) {
          this.addEdge(document.id, sibling.id, "sibling-order");
        }
      }

      // proxy-target
      if (document.proxyTargetId && this.nodeMap.has(document.proxyTargetId)) {
        this.addEdge(document.id, document.proxyTargetId, "proxy-target");
      }

      // internal-link
      const linkTargets = extractInternalLinkTargets(
        document.id,
        document.content,
        document.metadata.index,
      );
      for (const targetId of linkTargets) {
        if (this.nodeMap.has(targetId)) {
          this.addEdge(document.id, targetId, "internal-link");
        }
      }
    }
  }

  getRoots(): NavigationNode[] {
    return this.rootNodes;
  }

  getNode(id: string): NavigationNode | undefined {
    return this.nodeMap.get(id);
  }

  getParent(id: string): NavigationNode | undefined {
    const node = this.nodeMap.get(id);
    if (!node || node.parentId === null) return undefined;
    return this.nodeMap.get(node.parentId);
  }

  getChildren(id: string): NavigationNode[] {
    const node = this.nodeMap.get(id);
    return node ? [...node.children] : [];
  }

  getSiblings(id: string): NavigationNode[] {
    const node = this.nodeMap.get(id);
    if (!node) return [];

    if (node.parentId === null) {
      return this.rootNodes.filter((root) => root.id === id);
    }

    const parent = this.nodeMap.get(node.parentId);
    return parent ? [...parent.children] : [];
  }

  getAncestors(id: string): NavigationNode[] {
    const ancestors: NavigationNode[] = [];
    let current = this.getParent(id);

    while (current) {
      ancestors.push(current);
      current = this.getParent(current.id);
    }

    return ancestors;
  }

  getAllNodes(): NavigationNode[] {
    return Array.from(this.nodeMap.values());
  }

  getDependencies(id: string): DependencyEdge[] {
    return this.dependencies.get(id) ?? [];
  }

  getDependents(id: string): string[] {
    return Array.from(this.dependents.get(id) ?? []);
  }

  getIncomingEdges(id: string): DependencyEdge[] {
    return this.incoming.get(id) ?? [];
  }
}

export function buildDocumentGraph(documents: Document[]): DocumentGraph {
  const cached = graphCache.get(documents);
  if (cached) return cached;

  const graph = new DocumentGraphImpl(documents);
  graphCache.set(documents, graph);
  return graph;
}
