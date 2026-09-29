import { Result } from "../../shared/domain/Result";
import type { UserRepository } from "../domain/ports/UserRepository";
import type { UserProfile } from "../domain/types";
import { UserNotFoundError } from "./errors";

export class GetUserByEmail {
  constructor(private readonly repository: UserRepository) {}

  async execute(email: string): Promise<Result<Error, UserProfile>> {
    const result = await this.repository.getByEmail(email);
    if (!result.isSuccess) return Result.fail(result.getError());
    if (!result.getValue()) return Result.fail(new UserNotFoundError(email));
    return Result.ok(result.getValue().toProfile());
  }
}
