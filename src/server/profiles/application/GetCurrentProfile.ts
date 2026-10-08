import { Result } from "../../../shared/domain/Result";
import type { ProfileRepository } from "../domain/ports/ProfileRepository";
import type { PublicProfile } from "../domain/types";
import { ProfileNotFoundError } from "./errors";

export class GetCurrentProfile {
  constructor(private readonly repository: ProfileRepository) {}

  async execute(actorId: string): Promise<Result<Error, PublicProfile>> {
    const profile = await this.repository.getByUserId(actorId);
    if (!profile.isSuccess) return Result.fail(profile.getError());
    if (!profile.getValue()) return Result.fail(new ProfileNotFoundError(actorId));
    return Result.ok(profile.getValue().toPublic());
  }
}
