import { Result } from "../../../shared/domain/Result";
import type { ProfileRepository } from "../domain/ports/ProfileRepository";
import type { PublicProfile } from "../domain/types";
import { ProfileNotFoundError } from "./errors";

export interface UpdateCurrentProfileInput {
  displayName: string;
}

export class UpdateCurrentProfile {
  constructor(private readonly repository: ProfileRepository) {}

  async execute(actorId: string, input: UpdateCurrentProfileInput): Promise<Result<Error, PublicProfile>> {
    const profile = await this.repository.getByUserId(actorId);
    if (!profile.isSuccess) return Result.fail(profile.getError());
    if (!profile.getValue()) return Result.fail(new ProfileNotFoundError(actorId));

    const updated = profile.getValue().updateDisplayName(input.displayName);
    if (!updated.isSuccess) return Result.fail(updated.getError());

    const saved = await this.repository.update(profile.getValue());
    if (!saved.isSuccess) return Result.fail(saved.getError());
    return Result.ok(profile.getValue().toPublic());
  }
}
