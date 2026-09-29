import type { Result } from "../../../shared/domain/Result";
import type { User } from "../User";
import type { UserId } from "../UserId";
import type { UserEmailAlreadyExistsError, UserRepositoryError } from "../errors";

export type UserRepositoryResultError = UserRepositoryError | UserEmailAlreadyExistsError;

export interface UserRepository {
  getById(id: UserId): Promise<Result<UserRepositoryResultError, User | null>>;
  getByEmail(email: string): Promise<Result<UserRepositoryResultError, User | null>>;
  create(user: User): Promise<Result<UserRepositoryResultError, void>>;
  update(user: User): Promise<Result<UserRepositoryResultError, void>>;
  delete(id: UserId): Promise<Result<UserRepositoryResultError, void>>;
}
