import { Result } from "../../../shared/domain/Result";
import { Username } from "../domain/Username";
import type { ProfileRepository } from "../domain/ports/ProfileRepository";
import type { PublicProfile } from "../domain/types";
import { ProfileNotFoundError } from "./errors";

export class GetPublicProfileByUsername {
  constructor(private readonly repository: ProfileRepository) {}

  async execute(input: string): Promise<Result<Error, PublicProfile>> {
    const username = Username.create(input);
    if (!username.isSuccess) return Result.fail(username.getError());

    const profile = await this.repository.getByUsername(username.getValue());
    if (!profile.isSuccess) return Result.fail(profile.getError());
    if (!profile.getValue()) return Result.fail(new ProfileNotFoundError(input));
    return Result.ok(profile.getValue().toPublic());
  }
}
