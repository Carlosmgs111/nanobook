import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import { Result } from "../../../../shared/domain/Result";
import { Document } from "../../domain/Document";
import {
  DocumentAlreadyExistsError,
  DocumentNotFoundError,
  DocumentRevisionConflictError,
  DocumentRepositoryError,
  type DocumentParseError,
  type InvalidDocumentError,
  type InvalidDocumentIdError,
} from "../../domain/errors";
import type {
  ContentRepository,
  ContentRepositoryListError,
} from "../../domain/ports/ContentRepository";
import type { DocumentParser } from "../../domain/ports/DocumentParser";
import type { DocumentMetadata } from "../../domain/types";
import { document } from "../database/DrizzleDocumentSchema";
import { nanobook } from "../../../../nanobooks/server/infraestructure/database/DrizzleNanobookSchema";

type Database = LibSQLDatabase<any>;
type Failure = ContentRepositoryListError | DocumentRepositoryError | DocumentAlreadyExistsError | DocumentNotFoundError;

export class DrizzleContentRepository implements ContentRepository {
  constructor(
    private readonly database: Database,
    private readonly nanobookId: string,
    private readonly parser: DocumentParser | null = null,
  ) {}

  async list(): Promise<Result<ContentRepositoryListError, Document[]>> {
    try {
      const rows = await this.database
        .select()
        .from(document)
        .where(and(eq(document.nanobookId, this.nanobookId), isNull(document.deletedAt)))
        .orderBy(asc(document.path));
      return this.mapRows(rows);
    } catch (error) {
      return Result.fail(this.repositoryError("No fue posible listar los documentos", error));
    }
  }

  async getById(id: string) { return this.findOne(eq(document.id, id)); }

  async getByPath(path: string) { return this.findOne(eq(document.path, path)); }

  async getByPublicPath(path: string) { return this.findOne(eq(document.publicPath, path)); }

  async listChildren(parentPath: string | null) {
    try {
      const condition = parentPath === null
        ? isNull(document.parentPath)
        : eq(document.parentPath, parentPath);
      const rows = await this.database
        .select()
        .from(document)
        .where(and(eq(document.nanobookId, this.nanobookId), isNull(document.deletedAt), condition))
        .orderBy(asc(document.path));
      return this.mapRows(rows);
    } catch (error) {
      return Result.fail(this.repositoryError("No fue posible listar los hijos", error));
    }
  }

  async create(value: Document) {
    const row = await this.toRow(value);
    if (!row.isSuccess) return Result.fail(row.getError());
    try {
      await this.database.insert(document).values(row.getValue());
      await this.touchNanobook();
      return Result.ok();
    } catch (error) {
      if (isConstraintError(error)) return Result.fail(new DocumentAlreadyExistsError(value.getPath()));
      return Result.fail(this.repositoryError(`No fue posible crear "${value.getPath()}"`, error));
    }
  }

  async update(value: Document, previousPath?: string) {
    const currentRevision = await this.getRevision(value.getDocumentId().getValue());
    if (!currentRevision.isSuccess) return Result.fail(currentRevision.getError());
    if (currentRevision.getValue() === null) {
      return Result.fail(new DocumentNotFoundError(previousPath ?? value.getPath()));
    }
    return this.updateWithRevision(value, currentRevision.getValue(), previousPath);
  }

  async updateWithRevision(value: Document, expectedRevision: number, previousPath?: string) {
    const existing = await this.getById(value.getDocumentId().getValue());
    if (!existing.isSuccess) return Result.fail(existing.getError());
    if (!existing.getValue()) return Result.fail(new DocumentNotFoundError(previousPath ?? value.getPath()));

    if (previousPath && previousPath !== value.getPath()) {
      const target = await this.getByPath(value.getPath());
      if (!target.isSuccess) return Result.fail(target.getError());
      if (target.getValue() && target.getValue()?.getDocumentId().getValue() !== value.getDocumentId().getValue()) {
        return Result.fail(new DocumentAlreadyExistsError(value.getPath()));
      }
    }

    const row = await this.toRow(value, expectedRevision + 1);
    if (!row.isSuccess) return Result.fail(row.getError());
    try {
      const result = await this.database
        .update(document)
        .set(row.getValue())
        .where(and(
          eq(document.id, value.getDocumentId().getValue()),
          eq(document.nanobookId, this.nanobookId),
          eq(document.revision, expectedRevision),
          isNull(document.deletedAt),
        ));
      const rowsAffected = Number((result as { rowsAffected?: number }).rowsAffected ?? 0);
      if (rowsAffected === 0) {
        const actualRevision = await this.getRevision(value.getDocumentId().getValue());
        if (!actualRevision.isSuccess) return Result.fail(actualRevision.getError());
        if (actualRevision.getValue() === null) {
          return Result.fail(new DocumentNotFoundError(value.getPath()));
        }
        return Result.fail(new DocumentRevisionConflictError(
          value.getDocumentId().getValue(),
          expectedRevision,
          actualRevision.getValue(),
        ));
      }
      await this.touchNanobook();
      return Result.ok();
    } catch (error) {
      if (isConstraintError(error)) return Result.fail(new DocumentAlreadyExistsError(value.getPath()));
      return Result.fail(this.repositoryError(`No fue posible actualizar "${value.getPath()}"`, error));
    }
  }

  async delete(value: Document) {
    const existing = await this.getById(value.getDocumentId().getValue());
    if (!existing.isSuccess) return Result.fail(existing.getError());
    if (!existing.getValue()) return Result.fail(new DocumentNotFoundError(value.getPath()));
    try {
      await this.database
        .update(document)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(document.id, value.getDocumentId().getValue()), eq(document.nanobookId, this.nanobookId), isNull(document.deletedAt)));
      await this.touchNanobook();
      return Result.ok();
    } catch (error) {
      return Result.fail(this.repositoryError(`No fue posible eliminar "${value.getPath()}"`, error));
    }
  }

  clearCache(): void {}

  private async findOne(condition: any) {
    try {
      const [row] = await this.database
        .select()
        .from(document)
        .where(and(eq(document.nanobookId, this.nanobookId), isNull(document.deletedAt), condition))
        .limit(1);
      if (!row) return Result.ok(null);
      const mapped = this.mapRow(row);
      return mapped.isSuccess ? Result.ok(mapped.getValue()) : Result.fail(mapped.getError());
    } catch (error) {
      return Result.fail(this.repositoryError("No fue posible consultar el documento", error));
    }
  }

  private mapRows(rows: Array<typeof document.$inferSelect>) {
    const documents: Document[] = [];
    for (const row of rows) {
      const mapped = this.mapRow(row);
      if (!mapped.isSuccess) return Result.fail(mapped.getError());
      documents.push(mapped.getValue());
    }
    return Result.ok(documents);
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

  private async toRow(value: Document, revision = 1) {
    const metadata = value.getMetadata();
    const contentHash = await value.computeContentHash();
    return Result.ok({
      id: value.getDocumentId().getValue(),
      nanobookId: this.nanobookId,
      path: value.getPath(),
      publicPath: value.getPublicPath(),
      parentPath: value.getParentPath()?.getPublicValue() ?? null,
      title: value.getTitle(),
      description: value.getDescription(),
      body: value.getContent(),
      metadataJson: JSON.stringify(metadata, (_key, current) => current instanceof Date ? current.toISOString() : current),
      rawFrontmatter: value.getRawFrontmatter(),
      ownerId: metadata.ownerId ?? null,
      revision,
      contentHash,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      deletedAt: null,
    });
  }

  private async getRevision(id: string) {
    try {
      const [row] = await this.database
        .select({ revision: document.revision })
        .from(document)
        .where(and(eq(document.id, id), eq(document.nanobookId, this.nanobookId), isNull(document.deletedAt)))
        .limit(1);
      return Result.ok(row?.revision ?? null);
    } catch (error) {
      return Result.fail(this.repositoryError("No fue posible consultar la revisión del documento", error));
    }
  }

  private async touchNanobook(): Promise<void> {
    await this.database
      .update(nanobook)
      .set({ contentVersion: sql`${nanobook.contentVersion} + 1`, updatedAt: new Date() })
      .where(eq(nanobook.id, this.nanobookId));
  }

  private repositoryError(message: string, cause: unknown) {
    return new DocumentRepositoryError(message, { cause });
  }
}

function isConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.message} ${String(error.cause ?? "")}` : String(error);
  return /constraint failed|unique constraint|already exists/i.test(message);
}
