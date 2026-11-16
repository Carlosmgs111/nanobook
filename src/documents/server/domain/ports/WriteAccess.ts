import type { Result } from "../../../../shared/domain/Result";
import type { DocumentRepositoryError, WriteAccessDeniedError } from "../errors";

/**
 * Quién puede modificar el contenido de un nanobook. Lo implementa el módulo
 * dueño del nanobook; `documents` solo conoce este contrato.
 */
export interface WriteAccess {
  require(
    nanobookId: string,
    actorId: string,
  ): Promise<Result<WriteAccessDeniedError | DocumentRepositoryError, void>>;
}
