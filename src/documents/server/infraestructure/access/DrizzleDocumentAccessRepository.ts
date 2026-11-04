import { eq, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import { Result } from "../../../../shared/domain/Result";
import type { DocumentAccessRecord, DocumentAccessRepository } from "../../domain/access/ports";
import { DocumentRepositoryError } from "../../domain/errors";
import { documentAccess } from "../database/DrizzleDocumentSchema";

type Database = LibSQLDatabase<any>;

export class DrizzleDocumentAccessRepository implements DocumentAccessRepository {
  constructor(private readonly database: Database) {}

  async get(documentId: string) {
    try {
      const [row] = await this.database
        .select()
        .from(documentAccess)
        .where(eq(documentAccess.documentId, documentId))
        .limit(1);
      return Result.ok<DocumentAccessRecord | null>(
        row
          ? { documentId: row.documentId, passwordHash: row.passwordHash, passwordVersion: row.passwordVersion }
          : null,
      );
    } catch (error) {
      return Result.fail(new DocumentRepositoryError("No fue posible consultar el acceso del documento", { cause: error }));
    }
  }

  async setPasswordHash(documentId: string, passwordHash: string | null, at: Date) {
    try {
      await this.database
        .insert(documentAccess)
        .values({ documentId, passwordHash, passwordVersion: 1, updatedAt: at })
        .onConflictDoUpdate({
          target: documentAccess.documentId,
          set: {
            passwordHash,
            passwordVersion: sql`${documentAccess.passwordVersion} + 1`,
            updatedAt: at,
          },
        });
    } catch (error) {
      return Result.fail(new DocumentRepositoryError("No fue posible guardar el acceso del documento", { cause: error }));
    }

    const stored = await this.get(documentId);
    if (!stored.isSuccess) return Result.fail(stored.getError());
    const record = stored.getValue();
    if (!record) {
      return Result.fail(new DocumentRepositoryError("El acceso del documento no se persistió"));
    }
    return Result.ok(record);
  }
}
