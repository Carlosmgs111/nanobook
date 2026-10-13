import { eq, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import { nanobook } from "../../../../nanobooks/server/infraestructure/database/DrizzleNanobookSchema";
import { contentOutbox, documentRevision } from "./DrizzleDocumentRevisionSchema";

export type RevisionOperation = "import" | "create" | "update" | "move" | "delete";

export interface AppendRevisionInput {
  documentId: string;
  revision: number;
  snapshot: unknown;
  actorId: string;
  operation: RevisionOperation;
}

export interface DocumentUnitOfWorkContext {
  appendRevision(input: AppendRevisionInput): Promise<void>;
  enqueueEvent(eventType: string, payload: unknown): Promise<void>;
  incrementContentVersion(): Promise<number>;
}

type Database = LibSQLDatabase<any>;

export class DrizzleDocumentUnitOfWork {
  constructor(
    private readonly database: Database,
    private readonly nanobookId: string,
  ) {}

  async run<T>(work: (context: DocumentUnitOfWorkContext) => Promise<T>): Promise<T> {
    return this.database.transaction(async (transaction) => {
      let contentVersion: number | null = null;
      const context: DocumentUnitOfWorkContext = {
        appendRevision: async (input) => {
          await transaction.insert(documentRevision).values({
            documentId: input.documentId,
            revision: input.revision,
            snapshotJson: JSON.stringify(input.snapshot),
            actorId: input.actorId,
            operation: input.operation,
            createdAt: new Date(),
          });
        },
        enqueueEvent: async (eventType, payload) => {
          await transaction.insert(contentOutbox).values({
            id: crypto.randomUUID(),
            nanobookId: this.nanobookId,
            contentVersion: contentVersion ?? 0,
            eventType,
            payloadJson: JSON.stringify(payload),
            createdAt: new Date(),
            deliveredAt: null,
          });
        },
        incrementContentVersion: async () => {
          await transaction
            .update(nanobook)
            .set({ contentVersion: sql`${nanobook.contentVersion} + 1`, updatedAt: new Date() })
            .where(eq(nanobook.id, this.nanobookId));
          const [row] = await transaction
            .select({ contentVersion: nanobook.contentVersion })
            .from(nanobook)
            .where(eq(nanobook.id, this.nanobookId))
            .limit(1);
          contentVersion = row?.contentVersion ?? 0;
          return contentVersion;
        },
      };
      return work(context);
    });
  }
}
