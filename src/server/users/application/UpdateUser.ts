import { Result } from "../../../shared/domain/Result";
import { User } from "../domain/User";
import { UserId } from "../domain/UserId";
import type { UserRepository } from "../domain/ports/UserRepository";
import type { UserProfile } from "../domain/types";
import type { UpdateUserRequest } from "./dto/UpdateUserRequest";
import { UserNotFoundError } from "./errors";

export class UpdateUser {
  constructor(private readonly repository: UserRepository) {}

  async execute(
    userId: string,
    request: UpdateUserRequest
  ): Promise<Result<Error, UserProfile>> {
    const idResult = UserId.create(userId);
    if (!idResult.isSuccess) return Result.fail(idResult.getError());
    const existingResult = await this.repository.getById(idResult.getValue());
    if (!existingResult.isSuccess) return Result.fail(existingResult.getError());
    const user = existingResult.getValue();
    if (!user) return Result.fail(new UserNotFoundError(userId));
    const current = user.toProfile();
    const candidateResult = User.create({
      id: current.id,
      email: request.email ?? current.email,
      displayName: request.displayName ?? current.displayName,
      createdAt: current.createdAt,
      updatedAt: request.now ?? new Date(),
    });
    if (!candidateResult.isSuccess) return Result.fail(candidateResult.getError());
    const candidate = candidateResult.getValue();
    const saveResult = await this.repository.update(candidate);
    if (!saveResult.isSuccess) return Result.fail(saveResult.getError());
    return Result.ok(candidate.toProfile());
  }
}
