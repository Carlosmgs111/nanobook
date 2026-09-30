import { Result } from "../../../shared/domain/Result";
import { InvalidUserIdError } from "./errors";

export class UserId {
  static generate(): UserId {
    return new UserId(crypto.randomUUID());
  }

  static create(value: string): Result<InvalidUserIdError, UserId> {
    if (!value || value.trim() !== value) {
      return Result.fail(new InvalidUserIdError(value));
    }
    return Result.ok(new UserId(value));
  }

  private constructor(private readonly value: string) {}

  getValue(): string {
    return this.value;
  }
}
