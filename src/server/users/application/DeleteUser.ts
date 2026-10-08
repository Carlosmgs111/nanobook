import { Result } from "../../../shared/domain/Result";
import { UserId } from "../domain/UserId";
import type { UserRepository } from "../domain/ports/UserRepository";
import { UserNotFoundError } from "./errors";

export class DeleteUser {
  constructor(private readonly repository: UserRepository) {}

  async execute(userId: string): Promise<Result<Error, void>> {
    const idResult = UserId.create(userId);
    if (!idResult.isSuccess) return Result.fail(idResult.getError());
    const existingResult = await this.repository.getById(idResult.getValue());
    if (!existingResult.isSuccess) return Result.fail(existingResult.getError());
    if (!existingResult.getValue()) return Result.fail(new UserNotFoundError(userId));
    const deleteResult = await this.repository.delete(idResult.getValue());
    if (!deleteResult.isSuccess) return Result.fail(deleteResult.getError());
    return Result.ok();
  }
}
