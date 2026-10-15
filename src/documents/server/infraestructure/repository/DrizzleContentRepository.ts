import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import { Result } from "../../../../shared/domain/Result";
import { Document } from "../../domain/Document";
import {
  DocumentAlreadyExistsError,
  DocumentNotFoundError,
  DocumentRevisionConflictError,
  DocumentRepositoryError,
} from "../../domain/errors";
import type {
  ContentRepository,
  ContentRepositoryListError,
} from "../../domain/ports/ContentRepository";
import type { DocumentParser } from "../../domain/ports/DocumentParser";
import type { DocumentMetadata } from "../../domain/types";
import { serializeMetadata } from "../../domain/hash";
import { document } from "../database/DrizzleDocumentSchema";
import { contentOutbox, documentRevision } from "../database/DrizzleDocumentRevisionSchema";
import { nanobook } from "../../../../nanobooks/server/infraestructure/database/DrizzleNanobookSchema";

type Database = LibSQLDatabase<any>;

export class DrizzleContentRepository implements ContentRepository {
  constructor(
    private readonly database: Database,
    private readonly parser: DocumentParser | null = null,
  ) {}

  async list(nanobookId: string): Promise<Result<ContentRepositoryListError, Document[]>> {
    return this.listWhere(nanobookId, undefined, "No fue posible listar los documentos");
  }

  async getById(nanobookId: string, id: string) {
    return this.findOne(nanobookId, eq(document.id, id));
  }

  async getByPath(nanobookId: string, path: string) {
    return this.findOne(nanobookId, eq(document.path, path));
  }

  async getByPublicPath(nanobookId: string, path: string) {
    return this.findOne(nanobookId, eq(document.publicPath, path));
  }

  async listChildren(nanobookId: string, parentPath: string | null) {
    const condition = parentPath === null
      ? isNull(document.parentPath)
      : eq(document.parentPath, parentPath);
    return this.listWhere(nanobookId, condition, "No fue posible listar los hijos");
  }

  async create(nanobookId: string, value: Document) {
    const row = await this.toRow(nanobookId, value);
    if (!row.isSuccess) return Result.fail(row.getError());
    try {
      await this.database.transaction(async (transaction) => {
        await transaction.insert(document).values(row.getValue());
        await this.recordMutation(transaction, nanobookId, value, value.getRevision(), "create", value.parse());
      });
      return Result.ok();
    } catch (error) {
      if (isConstraintError(error)) return Result.fail(new DocumentAlreadyExistsError(value.getPath()));
      return Result.fail(this.repositoryError(`No fue posible crear "${value.getPath()}"`, error));
    }
  }

  async update(nanobookId: string, value: Document, previousPath?: string) {
    const currentRevision = await this.getRevision(nanobookId, value.getDocumentId().getValue());
    if (!currentRevision.isSuccess) return Result.fail(currentRevision.getError());
    if (currentRevision.getValue() === null) {
      return Result.fail(new DocumentNotFoundError(previousPath ?? value.getPath()));
    }
    return this.updateWithRevision(nanobookId, value, currentRevision.getValue(), previousPath);
  }

  async updateWithRevision(
    nanobookId: string,
    value: Document,
    expectedRevision: number,
    previousPath?: string,
  ) {
    if (previousPath && previousPath !== value.getPath()) {
      const target = await this.getByPath(nanobookId, value.getPath());
      if (!target.isSuccess) return Result.fail(target.getError());
      if (target.getValue() && target.getValue().getDocumentId().getValue() !== value.getDocumentId().getValue()) {
        return Result.fail(new DocumentAlreadyExistsError(value.getPath()));
      }
    }

    const row = await this.toRow(nanobookId, value, expectedRevision + 1);
    if (!row.isSuccess) return Result.fail(row.getError());
    try {
      let rowsAffected = 0;
      const nextRevision = expectedRevision + 1;
      await this.database.transaction(async (transaction) => {
        const result = await transaction
          .update(document)
          .set(row.getValue())
          .where(this.scope(nanobookId,
            eq(document.id, value.getDocumentId().getValue()),
            eq(document.revision, expectedRevision),
          ));
        rowsAffected = Number((result as { rowsAffected?: number }).rowsAffected ?? 0);
        if (rowsAffected > 0) {
          await this.recordMutation(
            transaction,
            nanobookId,
            value,
            nextRevision,
            previousPath && previousPath !== value.getPath() ? "move" : "update",
            { ...value.parse(), revision: nextRevision },
          );
        }
      });
      if (rowsAffected === 0) {
        const actualRevision = await this.getRevision(nanobookId, value.getDocumentId().getValue());
        if (!actualRevision.isSuccess) return Result.fail(actualRevision.getError());
        const actual = actualRevision.getValue();
        if (actual === null) {
          return Result.fail(new DocumentNotFoundError(value.getPath()));
        }
        return Result.fail(new DocumentRevisionConflictError(
          value.getDocumentId().getValue(),
          expectedRevision,
          actual,
        ));
      }
      return Result.ok();
    } catch (error) {
      if (isConstraintError(error)) return Result.fail(new DocumentAlreadyExistsError(value.getPath()));
      return Result.fail(this.repositoryError(`No fue posible actualizar "${value.getPath()}"`, error));
    }
  }

  async updateMany(
    nanobookId: string,
    updates: Array<{ document: Document; previousPath?: string; expectedRevision?: number }>,
  ) {
    try {
      await this.database.transaction(async (transaction) => {
        for (const item of updates) {
          const expectedRevision = item.expectedRevision ?? item.document.getRevision();
          const row = await this.toRow(nanobookId, item.document, expectedRevision + 1);
          if (!row.isSuccess) throw row.getError();
          const result = await transaction
            .update(document)
            .set(row.getValue())
            .where(this.scope(nanobookId,
              eq(document.id, item.document.getDocumentId().getValue()),
              eq(document.revision, expectedRevision),
            ));
          const rowsAffected = Number((result as { rowsAffected?: number }).rowsAffected ?? 0);
          if (rowsAffected === 0) {
            throw new DocumentRevisionConflictError(
              item.document.getDocumentId().getValue(),
              expectedRevision,
            );
          }
          await this.recordMutation(
            transaction,
            nanobookId,
            item.document,
            expectedRevision + 1,
            item.previousPath && item.previousPath !== item.document.getPath() ? "move" : "update",
            { ...item.document.parse(), revision: expectedRevision + 1 },
          );
        }
      });
      return Result.ok();
    } catch (error) {
      if (error instanceof DocumentRevisionConflictError) return Result.fail(error);
      if (error instanceof DocumentAlreadyExistsError) return Result.fail(error);
      return Result.fail(this.repositoryError("No fue posible actualizar el conjunto de documentos", error));
    }
  }

  async delete(nanobookId: string, value: Document) {
    return this.deleteMany(nanobookId, [value]);
  }

  async deleteMany(nanobookId: string, values: Document[]) {
    if (values.length === 0) return Result.ok();
    try {
      await this.database.transaction(async (transaction) => {
        for (const value of values) {
          const nextRevision = value.getRevision() + 1;
          const result = await transaction
            .update(document)
            .set({ deletedAt: new Date(), updatedAt: new Date(), revision: nextRevision })
            .where(this.scope(nanobookId,
              eq(document.id, value.getDocumentId().getValue()),
              eq(document.revision, value.getRevision()),
            ));
          const rowsAffected = Number((result as { rowsAffected?: number }).rowsAffected ?? 0);
          if (rowsAffected === 0) {
            throw new DocumentRevisionConflictError(
              value.getDocumentId().getValue(),
              value.getRevision(),
            );
          }
          await this.recordMutation(
            transaction,
            nanobookId,
            value,
            nextRevision,
            "delete",
            { ...value.parse(), revision: nextRevision },
          );
        }
      });
      return Result.ok();
    } catch (error) {
      if (error instanceof DocumentRevisionConflictError) return Result.fail(error);
      return Result.fail(this.repositoryError(`No fue posible eliminar "${value.getPath()}"`, error));
    }
  }

  clearCache(_nanobookId: string): void {}

  private async findOne(nanobookId: string, condition: any) {
    try {
      const [row] = await this.database
        .select()
        .from(document)
        .where(this.scope(nanobookId, condition))
        .limit(1);
      if (!row) return Result.ok(null);
      const mapped = this.mapRow(row);
      return mapped.isSuccess ? Result.ok(mapped.getValue()) : Result.fail(mapped.getError());
    } catch (error) {
      return Result.fail(this.repositoryError("No fue posible consultar el documento", error));
    }
  }

  private mapRows(rows: Array<typeof document.$inferSelect>) {
    const documents = rows.map((row) => this.mapRow(row));
    const failure = documents.find((result) => !result.isSuccess);
    if (failure && !failure.isSuccess) {
      return Result.fail(failure.getError());
    }
    return Result.ok(documents.map((result) => result.getValue()));
  }

  private mapRow(row: typeof document.$inferSelect) {
    let metadata: DocumentMetadata;
    try {
      const parsed = JSON.parse(row.metadataJson) as DocumentMetadata;
      metadata = {
        ...parsed,
        id: row.id,
        title: row.title,
        description: row.description,
        ownerId: row.ownerId ?? undefined,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        author: parsed.author ?? "Nanobook",
      };
    } catch (error) {
      return Result.fail(this.repositoryError("Los metadatos del documento no son válidos", error));
    }
    return Document.create(row.path, metadata, row.body, this.parser, row.rawFrontmatter, row.id, row.revision);
  }

  private async toRow(nanobookId: string, value: Document, revision = 1) {
    const metadata = value.getMetadata();
    const contentHash = await value.computeContentHash();
    return Result.ok({
      id: value.getDocumentId().getValue(),
      nanobookId,
      path: value.getPath(),
      publicPath: value.getPublicPath(),
      parentPath: value.getParentPath()?.getPublicValue() ?? null,
      title: value.getTitle(),
      description: value.getDescription(),
      body: value.getContent(),
      metadataJson: serializeMetadata(metadata),
      rawFrontmatter: value.getRawFrontmatter(),
      ownerId: metadata.ownerId ?? null,
      revision,
      contentHash,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      deletedAt: null,
    });
  }

  private async getRevision(nanobookId: string, id: string) {
    try {
      const [row] = await this.database
        .select({ revision: document.revision })
        .from(document)
        .where(this.scope(nanobookId, eq(document.id, id)))
        .limit(1);
      return Result.ok(row?.revision ?? null);
    } catch (error) {
      return Result.fail(this.repositoryError("No fue posible consultar la revisión del documento", error));
    }
  }

  private async recordMutation(
    transaction: any,
    nanobookId: string,
    value: Document,
    revision: number,
    operation: "create" | "update" | "move" | "delete",
    snapshot: unknown,
  ): Promise<void> {
    await transaction
      .update(nanobook)
      .set({ contentVersion: sql`${nanobook.contentVersion} + 1`, updatedAt: new Date() })
      .where(eq(nanobook.id, nanobookId));
    const [nanobookRow] = await transaction
      .select({ contentVersion: nanobook.contentVersion })
      .from(nanobook)
      .where(eq(nanobook.id, nanobookId))
      .limit(1);
    await transaction.insert(documentRevision).values({
      documentId: value.getDocumentId().getValue(),
      revision,
      snapshotJson: JSON.stringify(snapshot),
      actorId: value.getMetadata().ownerId ?? "system",
      operation,
      createdAt: new Date(),
    });
    await transaction.insert(contentOutbox).values({
      id: crypto.randomUUID(),
      nanobookId,
      contentVersion: nanobookRow?.contentVersion ?? 0,
      eventType: `document.${operation === "move" ? "updated" : `${operation}d`}`,
      payloadJson: JSON.stringify({
        documentId: value.getDocumentId().getValue(),
        revision,
        operation,
      }),
      createdAt: new Date(),
      deliveredAt: null,
    });
  }

  private repositoryError(message: string, cause: unknown) {
    return new DocumentRepositoryError(message, { cause });
  }

  private scope(nanobookId: string, ...conditions: any[]) {
    return and(
      eq(document.nanobookId, nanobookId),
      isNull(document.deletedAt),
      ...conditions,
    );
  }

  private async listWhere(nanobookId: string, condition: any, message: string) {
    try {
      const rows = await this.database
        .select()
        .from(document)
        .where(this.scope(nanobookId, ...(condition ? [condition] : [])))
        .orderBy(asc(document.path));
      return this.mapRows(rows);
    } catch (error) {
      return Result.fail(this.repositoryError(message, error));
    }
  }
}

function isConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.message} ${String(error.cause ?? "")}` : String(error);
  return /constraint failed|unique constraint|already exists/i.test(message);
}
