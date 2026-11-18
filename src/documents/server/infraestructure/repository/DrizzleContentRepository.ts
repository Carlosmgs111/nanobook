import { and, asc, eq, isNull } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import { Result } from "../../../../shared/domain/Result";
import { Document } from "../../domain/Document";
import {
  DocumentAlreadyExistsError,
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

type Database = LibSQLDatabase<any>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export class DrizzleContentRepository implements ContentRepository {
  constructor(
    private readonly database: Database,
    private readonly parser: DocumentParser | null = null
  ) {}

  async list(
    nanobookId: string
  ): Promise<Result<ContentRepositoryListError, Document[]>> {
    try {
      const rows = await this.database
        .select()
        .from(document)
        .where(this.scope(nanobookId))
        .orderBy(asc(document.path));
      return this.mapRows(rows);
    } catch (error) {
      return Result.fail(
        this.repositoryError("No fue posible listar los documentos", error)
      );
    }
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

  async create(nanobookId: string, value: Document) {
    const row = await this.toRow(nanobookId, value);
    try {
      await this.database.insert(document).values(row);
      return Result.ok();
    } catch (error) {
      if (isConstraintError(error))
        return Result.fail(new DocumentAlreadyExistsError(value.getPath()));
      return Result.fail(
        this.repositoryError(`No fue posible crear "${value.getPath()}"`, error)
      );
    }
  }

  async updateMany(
    nanobookId: string,
    updates: Array<{
      document: Document;
      expectedRevision?: number;
    }>
  ) {
    try {
      await this.database.transaction(async (transaction) => {
        for (const item of updates) {
          const expectedRevision =
            item.expectedRevision ?? item.document.getRevision();
          const row = await this.toRow(
            nanobookId,
            item.document,
            expectedRevision + 1
          );
          await this.updateAtRevision(
            transaction,
            nanobookId,
            item.document.getDocumentId().getValue(),
            expectedRevision,
            row
          );
        }
      });
      return Result.ok();
    } catch (error) {
      if (error instanceof DocumentRevisionConflictError)
        return Result.fail(error);
      return Result.fail(
        this.repositoryError(
          "No fue posible actualizar el conjunto de documentos",
          error
        )
      );
    }
  }

  async deleteMany(nanobookId: string, values: Document[]) {
    if (values.length === 0) return Result.ok();
    try {
      await this.database.transaction(async (transaction) => {
        for (const value of values) {
          await this.updateAtRevision(
            transaction,
            nanobookId,
            value.getDocumentId().getValue(),
            value.getRevision(),
            {
              deletedAt: new Date(),
              updatedAt: new Date(),
              revision: value.getRevision() + 1,
            }
          );
        }
      });
      return Result.ok();
    } catch (error) {
      if (error instanceof DocumentRevisionConflictError)
        return Result.fail(error);
      return Result.fail(
        this.repositoryError(
          "No fue posible eliminar el conjunto de documentos",
          error
        )
      );
    }
  }

  private async findOne(nanobookId: string, condition: any) {
    try {
      const [row] = await this.database
        .select()
        .from(document)
        .where(this.scope(nanobookId, condition))
        .limit(1);
      if (!row) return Result.ok(null);
      const mapped = this.mapRow(row);
      return mapped.isSuccess
        ? Result.ok(mapped.getValue())
        : Result.fail(mapped.getError());
    } catch (error) {
      return Result.fail(
        this.repositoryError("No fue posible consultar el documento", error)
      );
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
      return Result.fail(
        this.repositoryError(
          "Los metadatos del documento no son válidos",
          error
        )
      );
    }
    return Document.create(
      row.path,
      metadata,
      row.body,
      this.parser,
      row.rawFrontmatter,
      row.id,
      row.revision
    );
  }

  private async toRow(nanobookId: string, value: Document, revision = 1) {
    const metadata = value.getMetadata();
    const contentHash = await value.computeContentHash();
    return {
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
    };
  }

  /** Escribe la fila solo si sigue en la revisión esperada; si no, otro cambio se adelantó. */
  private async updateAtRevision(
    executor: Transaction,
    nanobookId: string,
    id: string,
    expectedRevision: number,
    values: Partial<typeof document.$inferInsert>
  ): Promise<void> {
    const result = await executor
      .update(document)
      .set(values)
      .where(
        this.scope(
          nanobookId,
          eq(document.id, id),
          eq(document.revision, expectedRevision)
        )
      );
    const rowsAffected = Number(
      (result as { rowsAffected?: number }).rowsAffected ?? 0
    );
    if (rowsAffected === 0) {
      throw new DocumentRevisionConflictError(id, expectedRevision);
    }
  }

  private repositoryError(message: string, cause: unknown) {
    return new DocumentRepositoryError(message, { cause });
  }

  private scope(nanobookId: string, ...conditions: any[]) {
    return and(
      eq(document.nanobookId, nanobookId),
      isNull(document.deletedAt),
      ...conditions
    );
  }
}

function isConstraintError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.message} ${String(error.cause ?? "")}`
      : String(error);
  return /constraint failed|unique constraint|already exists/i.test(message);
}
