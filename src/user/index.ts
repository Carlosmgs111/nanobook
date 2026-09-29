import { CreateUser } from "./application/CreateUser";
import { DeleteUser } from "./application/DeleteUser";
import { GetUser } from "./application/GetUser";
import { GetUserByEmail } from "./application/GetUserByEmail";
import { UpdateUser } from "./application/UpdateUser";
import { createUserRepository } from "./infraestructure/repository";
import type { EventBus } from "../shared/domain/bus/EventBus";

export { User } from "./domain/User";
export { UserId } from "./domain/UserId";
export type { UserProfile } from "./domain/types";
export {
  InvalidUserError,
  InvalidUserIdError,
  UserEmailAlreadyExistsError,
  UserRepositoryError,
} from "./domain/errors";
export { UserNotFoundError } from "./application/errors";
export type { CreateUserRequest } from "./application/dto/CreateUserRequest";
export type { UpdateUserRequest } from "./application/dto/UpdateUserRequest";
export type { UserRepository } from "./domain/ports/UserRepository";

export class UserModule {
  private constructor(
    public readonly createUser: CreateUser,
    public readonly getUser: GetUser,
    public readonly getUserByEmail: GetUserByEmail,
    public readonly updateUser: UpdateUser,
    public readonly deleteUser: DeleteUser
  ) {}

  static async create(_eventBus?: EventBus): Promise<UserModule> {
    const repository = createUserRepository();
    return new UserModule(
      new CreateUser(repository),
      new GetUser(repository),
      new GetUserByEmail(repository),
      new UpdateUser(repository),
      new DeleteUser(repository)
    );
  }
}
