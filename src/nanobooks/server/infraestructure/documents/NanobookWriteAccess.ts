import { DocumentRepositoryError, WriteAccessDeniedError, type WriteAccess } from "../../../../documents/server";
import { Result } from "../../../../shared/domain/Result";
import { NanobookAccessDeniedError } from "../../application/AuthorizeNanobook";
import { NanobookNotFoundError } from "../../application/errors";
import type { NanobookAccessRequirement } from "../../application/RequireNanobookAccess";

/** Puerto de escritura de `documents` respaldado por el permiso `write` del nanobook. */
export class NanobookWriteAccess implements WriteAccess {
  constructor(private readonly access: NanobookAccessRequirement) {}

  async require(
    nanobookId: string,
    actorId: string,
  ): Promise<Result<WriteAccessDeniedError | DocumentRepositoryError, void>> {
    const result = await this.access.execute(actorId, nanobookId, "write");
    if (result.isSuccess) return Result.ok();

    const error = result.getError();
    if (error instanceof NanobookAccessDeniedError || error instanceof NanobookNotFoundError) {
      return Result.fail(new WriteAccessDeniedError(nanobookId));
    }
    return Result.fail(
      new DocumentRepositoryError("No fue posible comprobar el permiso sobre el nanobook", { cause: error }),
    );
  }
}
