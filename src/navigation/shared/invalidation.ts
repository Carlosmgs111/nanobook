import type { DocumentGraphService } from "../domain/types";
import type {
  DependencyKind,
  DocumentChange,
  InvalidationResult,
} from "../domain/types";

function getAllowedKinds(
  change: DocumentChange,
): DependencyKind[] | "all" {
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
  allowed: DependencyKind[] | "all",
): boolean {
  return allowed === "all" || allowed.includes(kind);
}

/**
 * Indica si un conjunto de cambios requiere reconstruir el árbol de
 * navegación.
 *
 * El árbol debe recalcularse cuando cambia la estructura (documentos
 * agregados, eliminados, renombrados) o cuando cambian metadatos que
 * afectan jerarquía u orden (`position`, `title`, `draft`, `index`).
 *
 * Si todos los cambios son `modified` con `scope: "content"`, el árbol no
 * cambia; solo es necesario re-renderizar el cuerpo de los documentos
 * afectados (y sus proxies).
 */
export function shouldRebuildNavigationTree(
  changes: DocumentChange[],
): boolean {
  if (changes.length === 0) return false;

  return changes.some((change) => {
    if (change.kind !== "modified") return true;
    return change.scope !== "content";
  });
}

/**
 * Calcula el conjunto de documentos a regenerar ante un cambio.
 *
 * Reglas de propagación:
 * - `added` / `removed` / `renamed`: cambios estructurales; propagan por
 *   todas las aristas de dependencia.
 * - `modified` con `scope: "metadata"` o `"all"`: propagan por todas las
 *   aristas estructurales.
 * - `modified` con `scope: "content"`: solo propaga por aristas `proxy-target`
 *   (un proxy refleja el contenido de su target).
 *
 * La propagación se realiza por BFS sobre las aristas entrantes, evitando
 * ciclos.
 */
export function computeInvalidatedIds(
  graph: DocumentGraphService,
  changes: DocumentChange[],
): InvalidationResult {
  const addedIds = new Set<string>();
  const removedIds = new Set<string>();
  const invalidatedIds = new Set<string>();

  // Cada nodo en la cola lleva asociado los tipos de arista por los que puede
  // propagar su invalidación.
  const queue: { id: string; allowed: DependencyKind[] | "all" }[] = [];

  for (const change of changes) {
    const allowed = getAllowedKinds(change);

    switch (change.kind) {
      case "added":
        addedIds.add(change.id);
        invalidatedIds.add(change.id);
        queue.push({ id: change.id, allowed });
        break;

      case "removed":
        removedIds.add(change.id);
        invalidatedIds.add(change.id);
        queue.push({ id: change.id, allowed });
        break;

      case "modified":
        invalidatedIds.add(change.id);
        queue.push({ id: change.id, allowed });
        break;

      case "renamed":
        invalidatedIds.add(change.id);
        queue.push({ id: change.id, allowed });
        if (change.previousId) {
          removedIds.add(change.previousId);
          invalidatedIds.add(change.previousId);
          queue.push({ id: change.previousId, allowed });
        }
        break;
    }
  }

  let index = 0;
  while (index < queue.length) {
    const { id: currentId, allowed } = queue[index++];

    for (const edge of graph.getIncomingEdges(currentId)) {
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
