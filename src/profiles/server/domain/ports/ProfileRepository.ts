import type { Result } from "../../../../shared/domain/Result";
import type { Profile } from "../Profile";
import type { ProfileRepositoryError, UsernameAlreadyTakenError } from "../errors";
import type { Username } from "../Username";

export interface ProfileRepository {
  getByUserId(userId: string): Promise<Result<ProfileRepositoryError, Profile | null>>;
  getByUsername(username: Username): Promise<Result<ProfileRepositoryError, Profile | null>>;
  create(profile: Profile): Promise<Result<ProfileRepositoryError | UsernameAlreadyTakenError, void>>;
  update(profile: Profile): Promise<Result<ProfileRepositoryError, void>>;
}
