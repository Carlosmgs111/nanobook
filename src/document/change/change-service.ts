import { buildDocumentGraph } from "../../navigation/graph/graph";
import { computeInvalidatedIds } from "../../navigation/graph/invalidation";
import type {
  DocumentChange,
  DocumentGraph,
  InvalidationResult,
} from "../../navigation/model/types";
import type { ContentRepository, DocumentHash } from "../model/types";
import { computeDocumentChanges, hashDocument } from "./snapshot";

/**
 * Orquesta la detección de cambios y la invalidación de documentos
 * sin contaminar el contrato base de `ContentRepository`.
 */
export class ContentChangeService {
  constructor(private repository: ContentRepository) {}

  async list() {
    return this.repository.list();
  }

  async getGraph(): Promise<DocumentGraph> {
    const documents = await this.repository.list();
    return buildDocumentGraph(documents);
  }

  async detectChanges(
    previousHashes: DocumentHash[],
  ): Promise<DocumentChange[]> {
    const documents = await this.repository.list();
    const currentHashes = documents.map(hashDocument);
    return computeDocumentChanges(previousHashes, currentHashes);
  }

  async getInvalidatedIds(
    changes: DocumentChange[],
  ): Promise<InvalidationResult> {
    const graph = await this.getGraph();
    return computeInvalidatedIds(graph, changes);
  }
}
