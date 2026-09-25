import type { Document } from "../../document";
import type {
  DependencyEdge,
  DependencyKind,
  NavigationNode,
  DocumentChange,
  InvalidationResult,
} from "../domain/types";

function toNavigationNode(document: Document): NavigationNode {
  return {
    id: document.getDocumentId().getValue(),
    path: document.getPath(),
    slug: document.getSlug(),
    title: document.getTitle(),
    description: document.getDescription(),
    isIndex: document.getMetadata().index,
    parentId: undefined,
    position: document.getPosition(),
    metadata: document.getMetadata(),
    children: [],
  };
}

function sortNodes(nodes: NavigationNode[]): NavigationNode[] {
  return [...nodes].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return a.title.localeCompare(b.title);
  });
}


export class DocumentsGraph {
  private nodeMap: Map<string, NavigationNode>;
  private pathMap: Map<string, NavigationNode>;
  private rootNodes: NavigationNode[];
  private dependencies: Map<string, DependencyEdge[]>;
  private dependents: Map<string, Set<string>>;
  private incoming: Map<string, DependencyEdge[]>;

  constructor(documents: Document[]) {
    const map = new Map<string, NavigationNode>();
    const pathMap = new Map<string, NavigationNode>();

    for (const document of documents) {
      const node = toNavigationNode(document);
      map.set(node.id, node);
      pathMap.set(node.path, node);
    }

    for (const document of documents) {
      const node = map.get(document.getDocumentId().getValue())!;
      const parentPath = document.getParentPath()?.getValue();
      node.parentId = parentPath ? pathMap.get(parentPath)?.id : undefined;
    }

    const roots: NavigationNode[] = [];

    for (const node of map.values()) {
      if (node.parentId === undefined) {
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
    this.pathMap = pathMap;
    this.rootNodes = sortNodes(roots);
    this.dependencies = new Map();
    this.dependents = new Map();
    this.incoming = new Map();


    for (const document of documents) {
      const id = document.getDocumentId().getValue();
      this.dependencies.set(id, []);
      this.dependents.set(id, new Set());
      this.incoming.set(id, []);
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
    const documentsByParent = new Map<string | undefined, Document[]>();

    for (const document of documents) {
      const parentPath = document.getParentPath()?.getValue();
      const key = parentPath ? this.pathMap.get(parentPath)?.id : undefined;
      const siblings = documentsByParent.get(key) ?? [];
      siblings.push(document);
      documentsByParent.set(key, siblings);
    }

    for (const document of documents) {
      // parent-child: child -> parent
      const parentPath = document.getParentPath()?.getValue();
      const parentId = parentPath ? this.pathMap.get(parentPath)?.id : undefined;
      if (parentId && this.nodeMap.has(parentId)) {
        this.addEdge(document.getDocumentId().getValue(), parentId, "parent-child");
      }

      // parent-child: parent -> child
      const children = documentsByParent.get(document.getDocumentId().getValue()) ?? [];
      for (const child of children) {
        this.addEdge(
          document.getDocumentId().getValue(),
          child.getDocumentId().getValue(),
          "parent-child"
        );
      }

      // sibling-order: cada hermano depende de los demas
      const siblings =
        documentsByParent.get(document.getDocumentId().getValue()) ?? [];
      for (const sibling of siblings) {
        if (sibling.getDocumentId().getValue() !== document.getDocumentId().getValue()) {
          this.addEdge(
            document.getDocumentId().getValue(),
            sibling.getDocumentId().getValue(),
            "sibling-order"
          );
        }
      }

      // proxy-target
      const proxyTargetId = document.getProxyTargetId();
      const proxyTarget = proxyTargetId
        ? this.pathMap.get(proxyTargetId.getValue())
        : undefined;
      if (proxyTarget) {
        this.addEdge(
          document.getDocumentId().getValue(),
          proxyTarget.id,
          "proxy-target"
        );
      }

      // internal-link
      const linkTargets = document
        .getDocumentPath()
        .extractInternalLinkTargets(document.getContent());
      for (const targetId of linkTargets) {
        const target = this.pathMap.get(targetId);
        if (target) {
          this.addEdge(document.getDocumentId().getValue(), target.id, "internal-link");
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

  getNodeByPath(path: string): NavigationNode | undefined {
    return this.pathMap.get(path);
  }

  getParent(id: string): NavigationNode | undefined {
    const node = this.nodeMap.get(id);
    if (!node || node.parentId === null) return undefined;
    return this.nodeMap.get(node.parentId as string);
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

    const parent = this.nodeMap.get(node.parentId as string);
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
