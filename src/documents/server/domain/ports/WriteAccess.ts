import type { Result } from "../../../../shared/domain/Result";
import type { DocumentRepositoryError, WriteAccessDeniedError } from "../errors";

/** Quién puede modificar un nanobook; lo implementa el módulo dueño y `documents` solo conoce el contrato. */
export interface WriteAccess {
  require(
    nanobookId: string,
    actorId: string,
  ): Promise<Result<WriteAccessDeniedError | DocumentRepositoryError, void>>;
}
