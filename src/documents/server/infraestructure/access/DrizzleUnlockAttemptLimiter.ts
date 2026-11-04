import { and, eq, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";

import { Result } from "../../../../shared/domain/Result";
import type { AccessGrantPolicy } from "../../domain/access/AccessGrantPolicy";
import type { UnlockAttemptLimiter, UnlockAttemptStatus } from "../../domain/access/ports";
import { DocumentRepositoryError } from "../../domain/errors";
import { documentUnlockAttempt as attempts } from "../database/DrizzleDocumentSchema";

type Database = LibSQLDatabase<any>;

export class DrizzleUnlockAttemptLimiter implements UnlockAttemptLimiter {
  constructor(
    private readonly database: Database,
    private readonly policy: Pick<AccessGrantPolicy, "maxFailures" | "failureWindowSeconds">,
  ) {}

  async check(documentId: string, clientKey: string, now: Date) {
    try {
      const [row] = await this.database
        .select()
        .from(attempts)
        .where(and(eq(attempts.documentId, documentId), eq(attempts.clientKey, clientKey)))
        .limit(1);
      const windowEnd = row ? row.windowStartedAt.getTime() + this.policy.failureWindowSeconds * 1000 : 0;
      if (!row || windowEnd <= now.getTime() || row.failures < this.policy.maxFailures) {
        return Result.ok<UnlockAttemptStatus>({ blocked: false, retryAfterSeconds: 0 });
      }
      return Result.ok<UnlockAttemptStatus>({
        blocked: true,
        retryAfterSeconds: Math.max(1, Math.ceil((windowEnd - now.getTime()) / 1000)),
      });
    } catch (error) {
      return Result.fail(new DocumentRepositoryError("No fue posible comprobar los intentos de desbloqueo", { cause: error }));
    }
  }

  async recordFailure(documentId: string, clientKey: string, now: Date) {
    const floor = now.getTime() - this.policy.failureWindowSeconds * 1000;
    const nowMs = now.getTime();
    try {
      await this.database
        .insert(attempts)
        .values({ documentId, clientKey, windowStartedAt: now, failures: 1 })
        .onConflictDoUpdate({
          target: [attempts.documentId, attempts.clientKey],
          set: {
            failures: sql`CASE WHEN ${attempts.windowStartedAt} <= ${floor} THEN 1 ELSE ${attempts.failures} + 1 END`,
            windowStartedAt: sql`CASE WHEN ${attempts.windowStartedAt} <= ${floor} THEN ${nowMs} ELSE ${attempts.windowStartedAt} END`,
          },
        });
      return Result.ok();
    } catch (error) {
      return Result.fail(new DocumentRepositoryError("No fue posible registrar el intento fallido", { cause: error }));
    }
  }

  async reset(documentId: string, clientKey: string) {
    try {
      await this.database
        .delete(attempts)
        .where(and(eq(attempts.documentId, documentId), eq(attempts.clientKey, clientKey)));
      return Result.ok();
    } catch (error) {
      return Result.fail(new DocumentRepositoryError("No fue posible reiniciar los intentos", { cause: error }));
    }
  }
}
