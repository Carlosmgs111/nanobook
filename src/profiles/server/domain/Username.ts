import { Result } from "../../../shared/domain/Result";
import { InvalidUsernameError } from "./errors";

const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;

export class Username {
  private constructor(private readonly value: string) {}

  static create(input: string): Result<InvalidUsernameError, Username> {
    const value = input.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(value)) return Result.fail(new InvalidUsernameError(input));

    return Result.ok(new Username(value));
  }

  getValue(): string {
    return this.value;
  }
}
