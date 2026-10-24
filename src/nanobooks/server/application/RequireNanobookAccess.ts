import { Result } from "../../../shared/domain/Result";
import type { Nanobook } from "../domain/Nanobook";
import type { NanobookRepository, NanobookRepositoryFailure } from "../domain/ports/NanobookRepository";
import { AuthorizeNanobook, NanobookAccessDeniedError, type NanobookPermission } from "./AuthorizeNanobook";
import { NanobookNotFoundError } from "./errors";

export type RequireNanobookAccessError =
  | NanobookRepositoryFailure
  | NanobookNotFoundError
  | NanobookAccessDeniedError;

export class RequireNanobookAccess {
  constructor(
    private readonly repository: NanobookRepository,
    private readonly authorizer = new AuthorizeNanobook(),
  ) {}

  async execute(
    actorId: string | undefined,
    nanobookId: string,
    permission: NanobookPermission,
  ): Promise<Result<RequireNanobookAccessError, Nanobook>> {
    const result = await this.repository.findById(nanobookId);
    if (!result.isSuccess) return Result.fail(result.getError());

    const nanobook = result.getValue();
    if (!nanobook) return Result.fail(new NanobookNotFoundError(nanobookId));

    try {
      this.authorizer.assert(nanobook, permission, actorId);
      return Result.ok(nanobook);
    } catch (error) {
      if (error instanceof NanobookAccessDeniedError) return Result.fail(error);
      throw error;
    }
  }
}
