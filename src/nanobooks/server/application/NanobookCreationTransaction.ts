import type { Document } from "../../../documents/server/domain/Document";
import type { Result } from "../../../shared/domain/Result";
import type { Nanobook } from "../domain/Nanobook";
import type { NanobookRepositoryFailure } from "../domain/ports/NanobookRepository";

export interface NanobookCreationTransaction {
  insertDocument(document: Document): Promise<void>;
  appendRevision(input: {
    documentId: string;
    revision: number;
    snapshot: unknown;
    actorId: string;
    operation: "import" | "create" | "update" | "move" | "delete";
  }): Promise<void>;
  enqueueEvent(eventType: string, payload: unknown): Promise<void>;
  incrementContentVersion(): Promise<number>;
}

export type NanobookRootInitializer = (
  nanobook: Nanobook,
  transaction: NanobookCreationTransaction,
) => Promise<void>;

/**
 * Capacidad explícita para crear el nanobook y su documento raíz como una
 * única operación persistente.
 */
export interface NanobookCreationStore {
  createWithRoot(
    nanobook: Nanobook,
    initializeRoot: NanobookRootInitializer,
  ): Promise<Result<NanobookRepositoryFailure, void>>;
}
