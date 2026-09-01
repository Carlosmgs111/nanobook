import { graphService } from "../../navigation";
import { computeInvalidatedIds } from "../../navigation/shared/invalidation";
import type {
  DocumentChange,
  DocumentGraphService,
  InvalidationResult,
} from "../../navigation/domain/types";
import type { ContentRepository, DocumentHash } from "../_domain/types";
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

  async getGraph(): Promise<DocumentGraphService> {
    return graphService;
  }

  async detectChanges(
    previousHashes: DocumentHash[]
  ): Promise<DocumentChange[]> {
    const documents = await this.repository.list();
    const currentHashes = documents.map(hashDocument);
    return computeDocumentChanges(previousHashes, currentHashes);
  }

  async getInvalidatedIds(
    changes: DocumentChange[]
  ): Promise<InvalidationResult> {
    const graph = await this.getGraph();
    return computeInvalidatedIds(graph, changes);
  }
}
