import { Result } from "../../../shared/domain/Result";
import { UserId } from "./UserId";
import { InvalidUserError, InvalidUserIdError } from "./errors";
import type { CreateUserData, UpdateUserProfileData, UserProfile } from "./types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class User {
  private constructor(
    private readonly id: UserId,
    private email: string,
    private displayName: string,
    private readonly createdAt: Date,
    private updatedAt: Date
  ) {}

  static create(
    data: CreateUserData
  ): Result<InvalidUserError | InvalidUserIdError, User> {
    const idResult = data.id ? UserId.create(data.id) : Result.ok(UserId.generate());
    if (!idResult.isSuccess) return Result.fail(idResult.getError());

    const email = normalizeEmail(data.email);
    const displayName = data.displayName?.trim();
    const validationError = validateProfile(email, displayName);
    if (validationError) return Result.fail(validationError);

    const now = data.now ?? new Date();
    const createdAt = data.createdAt ?? now;
    const updatedAt = data.updatedAt ?? createdAt;
    return Result.ok(
      new User(idResult.getValue(), email, displayName, createdAt, updatedAt)
    );
  }

  updateProfile(data: UpdateUserProfileData): Result<InvalidUserError, void> {
    const email = data.email === undefined ? this.email : normalizeEmail(data.email);
    const displayName = data.displayName === undefined
      ? this.displayName
      : data.displayName.trim();
    const validationError = validateProfile(email, displayName);
    if (validationError) return Result.fail(validationError);

    this.email = email;
    this.displayName = displayName;
    this.updatedAt = data.now ?? new Date();
    return Result.ok();
  }

  getId(): UserId {
    return this.id;
  }

  toProfile(): UserProfile {
    return {
      id: this.id.getValue(),
      email: this.email,
      displayName: this.displayName,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validateProfile(email: string, displayName: string): InvalidUserError | null {
  if (!EMAIL_PATTERN.test(email)) return new InvalidUserError("email inválido");
  if (!displayName) return new InvalidUserError("el nombre visible es obligatorio");
  return null;
}
