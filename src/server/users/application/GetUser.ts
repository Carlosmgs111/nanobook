import { Result } from "../../../shared/domain/Result";
import { UserId } from "../domain/UserId";
import type { UserRepository } from "../domain/ports/UserRepository";
import type { UserProfile } from "../domain/types";
import { UserNotFoundError } from "./errors";

export class GetUser {
  constructor(private readonly repository: UserRepository) {}

  async execute(userId: string): Promise<Result<Error, UserProfile>> {
    const idResult = UserId.create(userId);
    if (!idResult.isSuccess) return Result.fail(idResult.getError());
    const result = await this.repository.getById(idResult.getValue());
    return this.toProfile(result, userId);
  }

  private toProfile(
    result: Awaited<ReturnType<UserRepository["getById"]>>,
    userId: string
  ): Result<Error, UserProfile> {
    if (!result.isSuccess) return Result.fail(result.getError());
    if (!result.getValue()) return Result.fail(new UserNotFoundError(userId));
    return Result.ok(result.getValue().toProfile());
  }
}
