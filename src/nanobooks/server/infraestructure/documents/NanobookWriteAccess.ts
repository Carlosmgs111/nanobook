import {
  AccessCheckFailedError,
  AccessDeniedError,
  Subject,
  type Authorizer,
} from "../../../../authorization/server";
import {
  DocumentRepositoryError,
  WriteAccessDeniedError,
  type WriteAccess,
} from "../../../../documents/server";
import { Result } from "../../../../shared/domain/Result";

/** Puerto de escritura de `documents` respaldado por la política de acceso de nanobooks. */
export class NanobookWriteAccess implements WriteAccess {
  constructor(private readonly authorizer: Authorizer) {}

  async require(
    nanobookId: string,
    actorId: string,
  ): Promise<Result<WriteAccessDeniedError | DocumentRepositoryError, void>> {
    const result = await this.authorizer.require({
      subject: Subject.of(actorId),
      action: "write",
      resource: { type: "nanobook", id: nanobookId },
    });
    if (result.isSuccess) return Result.ok();

    const error = result.getError();
    if (error instanceof AccessDeniedError) return Result.fail(new WriteAccessDeniedError(nanobookId));
    return Result.fail(
      new DocumentRepositoryError("No fue posible comprobar el permiso sobre el nanobook", {
        cause: (error as AccessCheckFailedError).cause,
      }),
    );
  }
}
