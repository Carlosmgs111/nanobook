import { Result } from "../../../../shared/domain/Result";
import { ProfileRepositoryError, UsernameAlreadyTakenError } from "../../domain/errors";
import type { ProfileRepository } from "../../domain/ports/ProfileRepository";
import type { Profile } from "../../domain/Profile";
import type { Username } from "../../domain/Username";

export class InMemoryProfileRepository implements ProfileRepository {
  private readonly profilesByUserId = new Map<string, Profile>();
  private readonly userIdByUsername = new Map<string, string>();

  async getByUserId(userId: string): Promise<Result<ProfileRepositoryError, Profile | null>> {
    return Result.ok(this.profilesByUserId.get(userId) ?? null);
  }

  async getByUsername(username: Username): Promise<Result<ProfileRepositoryError, Profile | null>> {
    const userId = this.userIdByUsername.get(username.getValue());
    return Result.ok(userId ? this.profilesByUserId.get(userId) ?? null : null);
  }

  async create(profile: Profile): Promise<Result<ProfileRepositoryError | UsernameAlreadyTakenError, void>> {
    const { username } = profile.toPublic();
    if (this.userIdByUsername.has(username)) return Result.fail(new UsernameAlreadyTakenError(username));

    this.profilesByUserId.set(profile.getUserId(), profile);
    this.userIdByUsername.set(username, profile.getUserId());
    return Result.ok();
  }

  async update(profile: Profile): Promise<Result<ProfileRepositoryError, void>> {
    this.profilesByUserId.set(profile.getUserId(), profile);
    return Result.ok();
  }
}
