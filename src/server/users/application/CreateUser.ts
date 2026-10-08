import { Result } from "../../../shared/domain/Result";
import { User } from "../domain/User";
import type { UserRepository } from "../domain/ports/UserRepository";
import type { UserProfile } from "../domain/types";
import type { CreateUserRequest } from "./dto/CreateUserRequest";

export class CreateUser {
  constructor(private readonly repository: UserRepository) {}

  async execute(
    request: CreateUserRequest
  ): Promise<Result<Error, UserProfile>> {
    const userResult = User.create(request);
    if (!userResult.isSuccess) return Result.fail(userResult.getError());
    const saveResult = await this.repository.create(userResult.getValue());
    if (!saveResult.isSuccess) return Result.fail(saveResult.getError());
    return Result.ok(userResult.getValue().toProfile());
  }
}
