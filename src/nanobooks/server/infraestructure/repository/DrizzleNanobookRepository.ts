import { asc, eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import { Result } from "../../../../shared/domain/Result";
import { Nanobook } from "../../domain/Nanobook";
import {
  NanobookRepositoryError,
  NanobookSlugAlreadyTakenError,
} from "../../domain/errors";
import type { NanobookRepository } from "../../domain/ports/NanobookRepository";
import type { NanobookSetupStatus } from "../../domain/types";
import { nanobook } from "../database/DrizzleNanobookSchema";

type Database = LibSQLDatabase<any>;

export class DrizzleNanobookRepository implements NanobookRepository {
  constructor(private readonly database: Database) {}

  async create(book: Nanobook) {
    try {
      const data = book.toPersistence();
      await this.database.insert(nanobook).values({
        id: data.id,
        ownerId: data.ownerId,
        slug: data.slug,
        name: data.name,
        visibility: data.visibility,
        settingsJson: JSON.stringify(data.settings),
        contentVersion: data.contentVersion,
        setupStatus: data.setupStatus ?? "ready",
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
      return Result.ok();
    } catch (error) {
      if (isUniqueViolation(error)) {
        return Result.fail(new NanobookSlugAlreadyTakenError(book.getSlug()));
      }
      return Result.fail(
        new NanobookRepositoryError("No fue posible crear el nanobook", {
          cause: error,
        }),
      );
    }
  }

  async findById(id: string) {
    return this.findOne(eq(nanobook.id, id));
  }

  async findBySlug(slug: string) {
    return this.findOne(eq(nanobook.slug, slug.trim().toLowerCase()));
  }

  async listByOwner(ownerId: string) {
    try {
      const rows = await this.database
        .select()
        .from(nanobook)
        .where(eq(nanobook.ownerId, ownerId))
        .orderBy(asc(nanobook.name));
      const books = rows.map((row) => this.toDomain(row));
      const invalid = books.find((result) => !result.isSuccess);
      if (invalid && !invalid.isSuccess) return Result.fail(invalid.getError());
      return Result.ok(books.map((result) => result.getValue()));
    } catch (error) {
      return Result.fail(
        new NanobookRepositoryError("No fue posible listar los nanobooks", {
          cause: error,
        }),
      );
    }
  }

  async updateSetupStatus(id: string, status: NanobookSetupStatus) {
    try {
      const result = await this.database
        .update(nanobook)
        .set({ setupStatus: status, updatedAt: new Date() })
        .where(eq(nanobook.id, id));
      const rowsAffected = Number((result as { rowsAffected?: number }).rowsAffected ?? 0);
      if (rowsAffected === 0) {
        return Result.fail(
          new NanobookRepositoryError(`El nanobook "${id}" no existe`),
        );
      }
      return Result.ok();
    } catch (error) {
      return Result.fail(
        new NanobookRepositoryError("No fue posible actualizar el estado del nanobook", {
          cause: error,
        }),
      );
    }
  }

  private async findOne(condition: any) {
    try {
      const [row] = await this.database
        .select()
        .from(nanobook)
        .where(condition)
        .limit(1);
      return Result.ok(row ? this.toDomain(row).getValue() : null);
    } catch (error) {
      return Result.fail(
        new NanobookRepositoryError("No fue posible consultar el nanobook", {
          cause: error,
        }),
      );
    }
  }

  private toDomain(row: typeof nanobook.$inferSelect) {
    let settings: Record<string, unknown>;
    try {
      const parsed = JSON.parse(row.settingsJson) as unknown;
      settings = parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return Result.fail(
        new NanobookRepositoryError("La configuración del nanobook no es válida"),
      );
    }
    return Nanobook.create({
      id: row.id,
      ownerId: row.ownerId,
      slug: row.slug,
      name: row.name,
      visibility: row.visibility,
      settings,
      contentVersion: row.contentVersion,
      setupStatus: row.setupStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  if (/unique constraint|constraint failed|already exists/i.test(message)) return true;
  return isUniqueViolation(error instanceof Error ? error.cause : undefined);
}
