import { Result } from "../../../shared/domain/Result";
import { Profile } from "../domain/Profile";
import type { ProfileRepository } from "../domain/ports/ProfileRepository";
import type { CreateProfileData } from "../domain/types";
import { ProfileAlreadyExistsError } from "./errors";

export type CreateCurrentProfileInput = Omit<CreateProfileData, "userId" | "now">;

export class CreateCurrentProfile {
  constructor(private readonly repository: ProfileRepository) {}

  async execute(actorId: string, input: CreateCurrentProfileInput): Promise<Result<Error, Profile>> {
    const existing = await this.repository.getByUserId(actorId);
    if (!existing.isSuccess) return Result.fail(existing.getError());
    if (existing.getValue()) return Result.fail(new ProfileAlreadyExistsError(actorId));

    const profile = Profile.create({ userId: actorId, ...input });
    if (!profile.isSuccess) return Result.fail(profile.getError());

    const saved = await this.repository.create(profile.getValue());
    if (!saved.isSuccess) return Result.fail(saved.getError());
    return Result.ok(profile.getValue());
  }
}
