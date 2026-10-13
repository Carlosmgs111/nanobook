import { eq, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import { nanobook } from "../../../../nanobooks/server/infraestructure/database/DrizzleNanobookSchema";
import type { Nanobook } from "../../../../nanobooks/server/domain/Nanobook";
import type { Document } from "../../domain/Document";
import { document as documentTable } from "../database/DrizzleDocumentSchema";
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
  insertNanobook(book: Nanobook): Promise<void>;
  insertDocument(document: Document): Promise<void>;
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
        insertNanobook: async (book) => {
          const data = book.toPersistence();
          await transaction.insert(nanobook).values({
            id: data.id,
            ownerId: data.ownerId,
            slug: data.slug,
            name: data.name,
            visibility: data.visibility,
            settingsJson: JSON.stringify(data.settings),
            contentVersion: data.contentVersion,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          });
        },
        insertDocument: async (value) => {
          const metadata = value.getMetadata();
          const contentHash = await value.computeContentHash();
          await transaction.insert(documentTable).values({
            id: value.getDocumentId().getValue(),
            nanobookId: this.nanobookId,
            path: value.getPath(),
            publicPath: value.getPublicPath(),
            parentPath: value.getParentPath()?.getPublicValue() ?? null,
            title: value.getTitle(),
            description: value.getDescription(),
            body: value.getContent(),
            metadataJson: JSON.stringify(metadata, (_key, current) =>
              current instanceof Date ? current.toISOString() : current,
            ),
            rawFrontmatter: value.getRawFrontmatter(),
            ownerId: metadata.ownerId ?? null,
            revision: value.getRevision(),
            contentHash,
            createdAt: metadata.createdAt,
            updatedAt: metadata.updatedAt,
            deletedAt: null,
          });
        },
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
