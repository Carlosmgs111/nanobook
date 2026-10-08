import { Result } from "../../../shared/domain/Result";
import { InvalidProfileError, type InvalidUsernameError } from "./errors";
import type { CreateProfileData, PersistedProfile, PublicProfile } from "./types";
import { Username } from "./Username";

export class Profile {
  private constructor(
    private readonly userId: string,
    private readonly username: Username,
    private displayName: string,
    private readonly createdAt: Date,
    private updatedAt: Date
  ) {}

  static create(data: CreateProfileData): Result<InvalidProfileError | InvalidUsernameError, Profile> {
    if (!data.userId.trim()) return Result.fail(new InvalidProfileError("userId es obligatorio"));

    const username = Username.create(data.username);
    if (!username.isSuccess) return Result.fail(username.getError());

    const displayName = data.displayName.trim();
    if (!displayName) return Result.fail(new InvalidProfileError("displayName es obligatorio"));

    const createdAt = data.createdAt ?? data.now ?? new Date();
    const updatedAt = data.updatedAt ?? createdAt;
    return Result.ok(new Profile(data.userId, username.getValue(), displayName, createdAt, updatedAt));
  }

  updateDisplayName(input: string, now = new Date()): Result<InvalidProfileError, void> {
    const displayName = input.trim();
    if (!displayName) return Result.fail(new InvalidProfileError("displayName es obligatorio"));

    this.displayName = displayName;
    this.updatedAt = now;
    return Result.ok();
  }

  getUserId(): string {
    return this.userId;
  }

  toPublic(): PublicProfile {
    return {
      username: this.username.getValue(),
      displayName: this.displayName,
    };
  }

  toPersistence(): PersistedProfile {
    return {
      userId: this.userId,
      ...this.toPublic(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
