import type { Document } from "../../../documents/server/domain/Document";
import type { Nanobook } from "../domain/Nanobook";

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
  transaction?: NanobookCreationTransaction,
) => Promise<void>;

export type AtomicNanobookCreator = (
  nanobook: Nanobook,
  initializeRoot: NanobookRootInitializer,
) => Promise<import("../../../shared/domain/Result").Result<unknown, void>>;
