import { eq } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import { Result } from "../../../../shared/domain/Result";
import { NanobookRepositoryError } from "../../domain/errors";
import {
  normalizeNanobookAliasPath,
  type NanobookAlias,
} from "../../domain/NanobookAlias";
import { nanobookAlias } from "../database/DrizzleNanobookAliasSchema";

type Database = LibSQLDatabase<any>;

export class DrizzleNanobookAliasRepository {
  constructor(private readonly database: Database) {}

  async findByLegacyPath(path: string): Promise<Result<NanobookRepositoryError, NanobookAlias | null>> {
    try {
      const [row] = await this.database
        .select()
        .from(nanobookAlias)
        .where(eq(nanobookAlias.legacyPath, normalizeNanobookAliasPath(path)))
        .limit(1);
      return Result.ok(row ? {
        legacyPath: row.legacyPath,
        nanobookId: row.nanobookId,
        targetPath: row.targetPath,
      } : null);
    } catch (error) {
      return Result.fail(new NanobookRepositoryError("No fue posible resolver el alias del nanobook", { cause: error }));
    }
  }
}
