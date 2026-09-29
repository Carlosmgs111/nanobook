export {
  UserEmailAlreadyExistsError,
  UserRepositoryError,
} from "../domain/errors";

import type {
  UserEmailAlreadyExistsError,
  UserRepositoryError,
} from "../domain/errors";

export type UserPersistenceError = UserRepositoryError | UserEmailAlreadyExistsError;
