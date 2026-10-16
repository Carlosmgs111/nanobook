import { and, asc, eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import { Result } from "../../../../shared/domain/Result";
import { Theme } from "../../domain/Theme";
import { ThemeRepositoryError } from "../../domain/errors";
import type { ThemeRepository } from "../../domain/ports/ThemeRepository";
import { theme } from "../database/DrizzleThemeSchema";

type Database = LibSQLDatabase<any>;

export class DrizzleThemeRepository implements ThemeRepository {
  constructor(private readonly database: Database) {}

  async create(value: Theme) {
    try {
      const data = value.toPersistence();
      await this.database.insert(theme).values({ ...data, tokensJson: JSON.stringify(data.tokens) });
      return Result.ok();
    } catch (error) {
      return Result.fail(new ThemeRepositoryError("No fue posible crear el tema", { cause: error }));
    }
  }

  async update(value: Theme) {
    try {
      const data = value.toPersistence();
      const result = await this.database.update(theme).set({
        name: data.name,
        baseThemeId: data.baseThemeId,
        tokensJson: JSON.stringify(data.tokens),
        updatedAt: new Date(),
      }).where(and(eq(theme.id, data.id), eq(theme.ownerId, data.ownerId)));
      if (Number(result.rowsAffected ?? 0) === 0) return Result.fail(new ThemeRepositoryError("El tema no existe"));
      return Result.ok();
    } catch (error) {
      return Result.fail(new ThemeRepositoryError("No fue posible actualizar el tema", { cause: error }));
    }
  }

  async findById(id: string) { return this.findOne(eq(theme.id, id)); }
  async findByOwner(ownerId: string, id: string) { return this.findOne(and(eq(theme.ownerId, ownerId), eq(theme.id, id))); }

  async listByOwner(ownerId: string) {
    try {
      const rows = await this.database.select().from(theme).where(eq(theme.ownerId, ownerId)).orderBy(asc(theme.name));
      const values = rows.map((row) => this.toDomain(row));
      const invalid = values.find((value) => !value.isSuccess);
      if (invalid && !invalid.isSuccess) return Result.fail(invalid.getError());
      return Result.ok(values.map((value) => value.getValue()));
    } catch (error) {
      return Result.fail(new ThemeRepositoryError("No fue posible listar los temas", { cause: error }));
    }
  }

  private async findOne(condition: any) {
    try {
      const [row] = await this.database.select().from(theme).where(condition).limit(1);
      if (!row) return Result.ok(null);
      return this.toDomain(row);
    } catch (error) {
      return Result.fail(new ThemeRepositoryError("No fue posible consultar el tema", { cause: error }));
    }
  }

  private toDomain(row: typeof theme.$inferSelect) {
    try {
      const parsed = JSON.parse(row.tokensJson) as unknown;
      const result = Theme.create({
        id: row.id, ownerId: row.ownerId, name: row.name, baseThemeId: row.baseThemeId,
        tokens: parsed, createdAt: row.createdAt, updatedAt: row.updatedAt,
      });
      return result.isSuccess
        ? Result.ok(result.getValue())
        : Result.fail(new ThemeRepositoryError("Los datos persistidos del tema no son válidos", { cause: result.getError() }));
    } catch (error) {
      return Result.fail(new ThemeRepositoryError("Los tokens persistidos del tema no son válidos", { cause: error }));
    }
  }
}
